package main

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
)

type Target struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

var targets = []Target{
	{"Google Main", "https://google.com"},
	{"Cloudflare DNS", "https://cloudflare.com"},
	{"GitHub API", "https://api.github.com"},
	// Add your critical infrastructure targets here
}

// Engine execution loop
func startMonitor(writeAPI api.WriteAPI) {
	log.Println("Starting Proactive Monitor Engine...")
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Perform initial check immediately
	checkTargets(writeAPI)

	for range ticker.C {
		checkTargets(writeAPI)
	}
}

// Executes concurrent checks for all targets
func checkTargets(writeAPI api.WriteAPI) {
	for _, t := range targets {
		go func(target Target) {
			latency, statusCode, err := checkHTTP(target.URL)
			sslDays := checkSSL(target.URL)

			if err != nil || statusCode >= 500 {
				log.Printf("[ALERT] Target %s down or failing! Status: %d, Err: %v\n", target.Name, statusCode, err)
				msg := fmt.Sprintf("\u26A0\uFE0F *Alert for %s* \nURL: %s\nStatus: %d\nError: %v", target.Name, target.URL, statusCode, err)
				sendTelegramAlert(msg)
			}

			// Write to InfluxDB Async Buffer
			p := influxdb2.NewPointWithMeasurement("http_check").
				AddTag("target", target.Name).
				AddTag("url", target.URL).
				AddField("latency_ms", latency).
				AddField("status_code", statusCode).
				AddField("ssl_days_remaining", sslDays).
				SetTime(time.Now())

			writeAPI.WritePoint(p)
			log.Printf("[METRIC] %s - Latency: %dms, SSL: %dd, Status: %d\n", target.Name, latency, sslDays, statusCode)
		}(t)
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
				InsecureSkipVerify: true, // Connect to inspect cert even if invalid locally
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

// Webhook payload to Telegram API
func sendTelegramAlert(message string) {
	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	chatID := os.Getenv("TELEGRAM_CHAT_ID")
	if botToken == "" || chatID == "" {
		return
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)
	payload := map[string]string{
		"chat_id":    chatID,
		"text":       message,
		"parse_mode": "Markdown",
	}
	jsonData, _ := json.Marshal(payload)

	resp, err := http.Post(apiURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("Failed to send Telegram alert: %v", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Printf("Telegram API returned status: %d", resp.StatusCode)
	}
}
