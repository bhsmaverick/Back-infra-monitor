package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
)

type Target struct {
	ID             string
	UserID         string
	Name           string
	URL            string
	ExpectedStatus int
}

type NotificationConfig struct {
	TelegramBotToken string
	TelegramChatID   string
}

// Engine execution loop
func startSaaSMonitor(dbPool *pgxpool.Pool, writeAPI api.WriteAPI) {
	log.Println("Starting Multi-Tenant Proactive Monitor Engine...")
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Initial trigger
	fetchAndCheckTargets(dbPool, writeAPI)

	for range ticker.C {
		fetchAndCheckTargets(dbPool, writeAPI)
	}
}

func fetchAndCheckTargets(dbPool *pgxpool.Pool, writeAPI api.WriteAPI) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Fetch all active targets
	rows, err := dbPool.Query(ctx, "SELECT id, user_id, name, url, expected_status FROM public.targets")
	if err != nil {
		log.Printf("Failed to fetch targets from PostgreSQL: %v\n", err)
		return
	}
	defer rows.Close()

	var targets []Target
	for rows.Next() {
		var t Target
		if err := rows.Scan(&t.ID, &t.UserID, &t.Name, &t.URL, &t.ExpectedStatus); err != nil {
			log.Printf("Row scan error: %v\n", err)
			continue
		}
		targets = append(targets, t)
	}

	// Fetch notification configs in a map mapped by user_id
	configRows, err := dbPool.Query(ctx, "SELECT user_id, telegram_bot_token, telegram_chat_id FROM public.notification_configs")
	if err != nil {
		log.Printf("Failed to fetch notification configs: %v\n", err)
		return
	}
	defer configRows.Close()

	configs := make(map[string]NotificationConfig)
	for configRows.Next() {
		var userID, token, chatID string
		if err := configRows.Scan(&userID, &token, &chatID); err != nil {
			continue
		}
		configs[userID] = NotificationConfig{
			TelegramBotToken: token,
			TelegramChatID:   chatID,
		}
	}

	// Perform checks concurrently
	for _, t := range targets {
		go func(target Target, conf NotificationConfig) {
			latency, statusCode, err := checkHTTP(target.URL)
			sslDays := checkSSL(target.URL)

			if err != nil || statusCode != target.ExpectedStatus {
				log.Printf("[ALERT] Target %s (%s) down or failing! Status: %d, Err: %v\n", target.Name, target.URL, statusCode, err)
				msg := fmt.Sprintf("\u26A0\uFE0F *Alert for %s*\nURL: %s\nExpected: %d\nReceived: %d\nError: %v", target.Name, target.URL, target.ExpectedStatus, statusCode, err)
				
				// Send alert using the user's specific Telegram config
				if conf.TelegramBotToken != "" && conf.TelegramChatID != "" {
					sendCustomTelegramAlert(conf.TelegramBotToken, conf.TelegramChatID, msg)
				} else {
					log.Printf("No Telegram config found for user %s, skipping alert.", target.UserID)
				}
			}

			// Write to InfluxDB Async Buffer tagged with user_id and target_id
			p := influxdb2.NewPointWithMeasurement("http_check").
				AddTag("user_id", target.UserID).
				AddTag("target_id", target.ID).
				AddTag("target_name", target.Name).
				AddTag("url", target.URL).
				AddField("latency_ms", latency).
				AddField("status_code", statusCode).
				AddField("ssl_days_remaining", sslDays).
				SetTime(time.Now())

			writeAPI.WritePoint(p)
			log.Printf("[METRIC] UID: %s | %s - Latency: %dms, SSL: %dd, Status: %d\n", target.UserID, target.Name, latency, sslDays, statusCode)
		}(t, configs[t.UserID])
	}
}

// Real HTTP GET to measure actual latency and status
func checkHTTP(url string) (int64, int, error) {
	client := http.Client{
		Timeout: 10 * time.Second,
	}

	start := time.Now()
	resp, err := client.Get(url)
	if err != nil {
		return 0, 0, err
	}
	defer resp.Body.Close()

	latency := time.Since(start).Milliseconds()
	return latency, resp.StatusCode, nil
}

// Real TLS handshake matching to find certificate expiry
func checkSSL(targetURL string) int {
	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true,
			},
		},
		Timeout: 5 * time.Second,
	}

	resp, err := client.Get(targetURL)
	if err != nil || resp.TLS == nil || len(resp.TLS.PeerCertificates) == 0 {
		return 0
	}
	defer resp.Body.Close()

	cert := resp.TLS.PeerCertificates[0]
	daysRemaining := int(time.Until(cert.NotAfter).Hours() / 24)
	return daysRemaining
}

// Webhook payload to custom Telegram API tokens
func sendCustomTelegramAlert(botToken, chatID, message string) {
	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)
	payload := map[string]string{
		"chat_id":    chatID,
		"text":       message,
		"parse_mode": "Markdown",
	}
	jsonData, _ := json.Marshal(payload)

	resp, err := http.Post(apiURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("Failed to send custom Telegram alert: %v", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Printf("Telegram API returned status: %d", resp.StatusCode)
	}
}

func main() {
	log.Println("Initializing Multi-Tenant Proactive Infrastructure Monitor")

	// 1. Init Postgres
	pgConnString := os.Getenv("POSTGRES_URL")
	if pgConnString == "" {
		log.Fatal("POSTGRES_URL is required (e.g. postgres://user:pass@host:5432/db)")
	}

	dbPool, err := pgxpool.New(context.Background(), pgConnString)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	defer dbPool.Close()

	// 2. Init InfluxDB
	influxURL := os.Getenv("INFLUXDB_URL")
	if influxURL == "" {
		influxURL = "http://localhost:8086"
	}
	influxToken := os.Getenv("INFLUXDB_TOKEN")
	if influxToken == "" {
		log.Fatal("INFLUXDB_TOKEN is required")
	}

	client := influxdb2.NewClientWithOptions(influxURL, influxToken, influxdb2.DefaultOptions().SetBatchSize(20))
	defer client.Close()

	org := os.Getenv("INFLUXDB_ORG")
	bucket := os.Getenv("INFLUXDB_BUCKET")
	writeAPI := client.WriteAPI(org, bucket)
	defer writeAPI.Flush()

	// Start Engine Loop
	startSaaSMonitor(dbPool, writeAPI)

	// Keep alive
	select {}
}
