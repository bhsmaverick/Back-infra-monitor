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
	"sync"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Target struct {
	ID             string  `json:"id"`
	UserID         string  `json:"user_id"`
	ProjectID      *string `json:"project_id"`
	Name           string  `json:"name"`
	URL            string  `json:"url"`
	ExpectedStatus int     `json:"expected_status"`
	CheckInterval  int     `json:"check_interval"`
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

type AppNotification struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	TargetID  string    `json:"target_id"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
}

var (
	appNotifsMu sync.RWMutex
	appNotifs   []AppNotification
)

var (
	vapidPublicKey  = os.Getenv("VAPID_PUBLIC_KEY")
	vapidPrivateKey = os.Getenv("VAPID_PRIVATE_KEY")
)

type WebPushSub struct {
	Endpoint string `json:"endpoint"`
	P256dh   string `json:"p256dh"`
	Auth     string `json:"auth"`
}

func sendWebPush(dbPool *pgxpool.Pool, userID string, msg string) {
	if vapidPublicKey == "" || vapidPrivateKey == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := dbPool.Query(ctx, "SELECT endpoint, p256dh, auth FROM public.web_push_subscriptions WHERE user_id = $1", userID)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var sub WebPushSub
		if err := rows.Scan(&sub.Endpoint, &sub.P256dh, &sub.Auth); err != nil {
			continue
		}

		s := &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys: webpush.Keys{
				P256dh: sub.P256dh,
				Auth:   sub.Auth,
			},
		}

		go func(sub *webpush.Subscription) {
			_, err := webpush.SendNotification([]byte(msg), sub, &webpush.Options{
				Subscriber:      "mailto:admin@inframonitor.local",
				VAPIDPublicKey:  vapidPublicKey,
				VAPIDPrivateKey: vapidPrivateKey,
				TTL:             30,
			})
			if err != nil {
				log.Printf("WebPush error: %v", err)
			}
		}(s)
	}
}

type MonitorState struct {
	Target Target
	Cancel context.CancelFunc
}

func startSaaSMonitor(dbPool *pgxpool.Pool, writeAPI api.WriteAPI) {
	log.Println("Starting Dynamic Multi-Tenant Proactive Monitor Engine...")

	activeMonitors := make(map[string]*MonitorState)
	var mu sync.Mutex

	syncTicker := time.NewTicker(10 * time.Second)
	defer syncTicker.Stop()

	for {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		rows, err := dbPool.Query(ctx, "SELECT id, user_id, project_id, name, url, expected_status, check_interval FROM public.targets")
		if err != nil {
			log.Printf("Failed to fetch targets for sync: %v", err)
			cancel()
			time.Sleep(10 * time.Second)
			continue
		}

		configRows, _ := dbPool.Query(ctx, "SELECT user_id, telegram_bot_token, telegram_chat_id FROM public.notification_configs")
		configs := make(map[string]NotificationConfig)
		if configRows != nil {
			for configRows.Next() {
				var uid, tk, ci string
				if configRows.Scan(&uid, &tk, &ci) == nil {
					configs[uid] = NotificationConfig{TelegramBotToken: tk, TelegramChatID: ci}
				}
			}
			configRows.Close()
		}

		currentTargets := make(map[string]Target)
		for rows.Next() {
			var t Target
			if err := rows.Scan(&t.ID, &t.UserID, &t.ProjectID, &t.Name, &t.URL, &t.ExpectedStatus, &t.CheckInterval); err == nil {
				if t.CheckInterval <= 0 {
					t.CheckInterval = 30 // Fail-safe
				}
				currentTargets[t.ID] = t
			}
		}
		rows.Close()
		cancel()

		mu.Lock()
		
		// Stop deleted or modified targets
		for id, state := range activeMonitors {
			newT, exists := currentTargets[id]
			if !exists || state.Target.URL != newT.URL || state.Target.CheckInterval != newT.CheckInterval || state.Target.ExpectedStatus != newT.ExpectedStatus {
				state.Cancel()
				delete(activeMonitors, id)
			}
		}

		// Start new monitors
		for id, t := range currentTargets {
			if _, running := activeMonitors[id]; !running {
				mCtx, mCancel := context.WithCancel(context.Background())
				state := &MonitorState{
					Target: t,
					Cancel: mCancel,
				}
				activeMonitors[id] = state
				go runTargetMonitor(mCtx, t, configs[t.UserID], dbPool, writeAPI)
			}
		}

		mu.Unlock()

		<-syncTicker.C
	}
}

func runTargetMonitor(ctx context.Context, target Target, conf NotificationConfig, dbPool *pgxpool.Pool, writeAPI api.WriteAPI) {
	ticker := time.NewTicker(time.Duration(target.CheckInterval) * time.Second)
	defer ticker.Stop()

	// Initial check
	checkSingleTarget(target, conf, dbPool, writeAPI)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			checkSingleTarget(target, conf, dbPool, writeAPI)
		}
	}
}

func checkSingleTarget(target Target, conf NotificationConfig, dbPool *pgxpool.Pool, writeAPI api.WriteAPI) {
	latency, statusCode, err := checkHTTP(target.URL)
	sslDays := checkSSL(target.URL)

	if err != nil || statusCode != target.ExpectedStatus {
		log.Printf("[ALERT] Target %s (%s) down or failing! Status: %d, Err: %v\n", target.Name, target.URL, statusCode, err)
		msg := fmt.Sprintf("⚠️ *Alert for %s*\nURL: %s\nExpected: %d\nReceived: %d\nError: %v", target.Name, target.URL, target.ExpectedStatus, statusCode, err)

		// 1. Telegram
		if conf.TelegramBotToken != "" && conf.TelegramChatID != "" {
			sendCustomTelegramAlert(conf.TelegramBotToken, conf.TelegramChatID, msg)
		}

		// 2. Web Push
		plainMsg := fmt.Sprintf("Alert for %s: Status %d", target.Name, statusCode)
		sendWebPush(dbPool, target.UserID, plainMsg)

		// 3. In-Memory Notifications (for frontend UI bell)
		appNotifsMu.Lock()
		appNotifs = append([]AppNotification{{
			ID:        fmt.Sprintf("%d", time.Now().UnixNano()),
			UserID:    target.UserID,
			TargetID:  target.ID,
			Message:   plainMsg,
			CreatedAt: time.Now(),
		}}, appNotifs...)
		if len(appNotifs) > 100 {
			appNotifs = appNotifs[:100]
		}
		appNotifsMu.Unlock()
	}

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
	log.Printf("[METRIC] UID: %s | %s [%ds] - Latency: %dms, SSL: %dd, Status: %d\n", target.UserID, target.Name, target.CheckInterval, latency, sslDays, statusCode)
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
	// GET, DELETE /api/targets
	http.HandleFunc("/api/targets", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.Method == http.MethodDelete {
			targetID := r.URL.Query().Get("id")
			userID := r.URL.Query().Get("user_id")

			if targetID == "" || userID == "" {
				http.Error(w, "Query parameters 'id' and 'user_id' are required", http.StatusBadRequest)
				return
			}

			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			_, err := dbPool.Exec(ctx, "DELETE FROM public.targets WHERE id = $1 AND user_id = $2", targetID, userID)
			if err != nil {
				log.Printf("Failed to delete target: %v\n", err)
				http.Error(w, "Failed to delete target", http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.Method == http.MethodGet {
			w.Header().Set("Content-Type", "application/json")

			userID := r.URL.Query().Get("user_id")
			if userID == "" {
				http.Error(w, "Query parameter 'user_id' is required", http.StatusBadRequest)
				return
			}

			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			rows, err := dbPool.Query(ctx, "SELECT id, user_id, project_id, name, url, expected_status, check_interval FROM public.targets WHERE user_id = $1", userID)
			if err != nil {
				log.Printf("Failed to fetch user targets: %v\n", err)
				http.Error(w, "Database query failed", http.StatusInternalServerError)
				return
			}
			defer rows.Close()

			var targets []Target = []Target{}
			for rows.Next() {
				var t Target
				if err := rows.Scan(&t.ID, &t.UserID, &t.ProjectID, &t.Name, &t.URL, &t.ExpectedStatus, &t.CheckInterval); err != nil {
					continue
				}
				targets = append(targets, t)
			}

			json.NewEncoder(w).Encode(targets)
			return
		}
	})

	// GET /api/notifications
	http.HandleFunc("/api/notifications", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		userID := r.URL.Query().Get("user_id")
		if userID == "" {
			http.Error(w, "user_id is required", http.StatusBadRequest)
			return
		}

		var userNotifs []AppNotification = []AppNotification{}
		appNotifsMu.RLock()
		for _, n := range appNotifs {
			if n.UserID == userID {
				userNotifs = append(userNotifs, n)
			}
		}
		appNotifsMu.RUnlock()

		json.NewEncoder(w).Encode(userNotifs)
	})

	// GET /api/webpush/vapid-key
	http.HandleFunc("/api/webpush/vapid-key", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		pubKey := os.Getenv("VAPID_PUBLIC_KEY")
		if pubKey == "" {
			http.Error(w, "VAPID configuration missing on server", http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"publicKey": pubKey})
	})

	// POST /api/webpush/subscribe
	http.HandleFunc("/api/webpush/subscribe", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.Method == http.MethodPost {
			userID := r.URL.Query().Get("user_id")
			if userID == "" {
				http.Error(w, "user_id is required", http.StatusBadRequest)
				return
			}

			var sub WebPushSub
			if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
				http.Error(w, "Invalid body", http.StatusBadRequest)
				return
			}

			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			_, err := dbPool.Exec(ctx, "INSERT INTO public.web_push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)", userID, sub.Endpoint, sub.P256dh, sub.Auth)
			if err != nil {
				log.Printf("Failed to insert web push sub: %v", err)
				http.Error(w, "Failed to save subscription", http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)
		}
	})

	// GET /api/metrics/latency
	http.HandleFunc("/api/metrics/latency", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		w.Header().Set("Content-Type", "application/json")

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
