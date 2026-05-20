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

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Target struct {
	ID             string `json:"id"`
	UserID         string `json:"user_id"`
	Name           string `json:"name"`
	URL            string `json:"url"`
	ExpectedStatus int    `json:"expected_status"`
}

type NotificationConfig struct {
	TelegramBotToken string
	TelegramChatID   string
}

type MetricData struct {
	Time  time.Time   `json:"time"`
	Field string      `json:"field"`
	Value interface{} `json:"value"`
}

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

	// Fetch notification configs
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
				msg := fmt.Sprintf("⚠️ *Alert for %s*\nURL: %s\nExpected: %d\nReceived: %d\nError: %v", target.Name, target.URL, target.ExpectedStatus, statusCode, err)
				
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

// startAPI initializes the REST endpoints
func startAPI(dbPool *pgxpool.Pool, influxClient influxdb2.Client) {
	// GET /api/targets
	http.HandleFunc("/api/targets", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		userID := r.URL.Query().Get("user_id")
		if userID == "" {
			http.Error(w, "Query parameter 'user_id' is required", http.StatusBadRequest)
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		rows, err := dbPool.Query(ctx, "SELECT id, user_id, name, url, expected_status FROM public.targets WHERE user_id = $1", userID)
		if err != nil {
			log.Printf("Failed to fetch user targets: %v\n", err)
			http.Error(w, "Database query failed", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var targets []Target = []Target{}
		for rows.Next() {
			var t Target
			if err := rows.Scan(&t.ID, &t.UserID, &t.Name, &t.URL, &t.ExpectedStatus); err != nil {
				continue
			}
			targets = append(targets, t)
		}

		json.NewEncoder(w).Encode(targets)
	})

	// GET /api/metrics/latency
	http.HandleFunc("/api/metrics/latency", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		userID := r.URL.Query().Get("user_id")
		targetID := r.URL.Query().Get("target_id")

		if userID == "" || targetID == "" {
			http.Error(w, "Query parameters 'user_id' and 'target_id' are required", http.StatusBadRequest)
			return
		}

		org := os.Getenv("INFLUXDB_ORG")
		bucket := os.Getenv("INFLUXDB_BUCKET")
		queryAPI := influxClient.QueryAPI(org)

		// Flux query to fetch recent metrics across fields, filtered by BOTH user_id and target_id
		query := fmt.Sprintf(`
			from(bucket:"%s")
				|> range(start: -1h)
				|> filter(fn: (r) => r._measurement == "http_check")
				|> filter(fn: (r) => r.user_id == "%s")
				|> filter(fn: (r) => r.target_id == "%s")
				|> filter(fn: (r) => r._field == "latency_ms" or r._field == "ssl_days_remaining" or r._field == "status_code")
				|> yield(name: "results")
		`, bucket, userID, targetID)

		result, err := queryAPI.Query(context.Background(), query)
		if err != nil {
			log.Printf("Query error: %v\n", err)
			http.Error(w, "Database query failed", http.StatusInternalServerError)
			return
		}

		var metrics []MetricData = []MetricData{}
		for result.Next() {
			metrics = append(metrics, MetricData{
				Time:  result.Record().Time(),
				Field: result.Record().Field(),
				Value: result.Record().Value(),
			})
		}

		if result.Err() != nil {
			log.Printf("Parsing error: %v\n", result.Err())
			http.Error(w, "Failed parsing database stream", http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(metrics)
	})

	log.Println("Starting REST API on :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("API Server crash: %v", err)
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

	// 3. Start Engine Loop
	go startSaaSMonitor(dbPool, writeAPI)

	// 4. Start REST API
	startAPI(dbPool, client)
}
