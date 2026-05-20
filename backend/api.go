package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
)

// Metric output response shape
type MetricData struct {
	Time  time.Time   `json:"time"`
	Field string      `json:"field"`
	Value interface{} `json:"value"`
}

// startAPI initializes the REST endpoints
func startAPI(dbClient influxdb2.Client) {
	// 1. GET /api/targets (List current active targets)
	http.HandleFunc("/api/targets", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(targets)
	})

	// 2. GET /api/metrics/latency (Return actual time-series data for the graph)
	http.HandleFunc("/api/metrics/latency", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		targetName := r.URL.Query().Get("target")
		if targetName == "" {
			http.Error(w, "Query parameter 'target' is required", http.StatusBadRequest)
			return
		}

		org := os.Getenv("INFLUXDB_ORG")
		bucket := os.Getenv("INFLUXDB_BUCKET")
		queryAPI := dbClient.QueryAPI(org)

		// Flux query to fetch recent metrics across fields
		query := fmt.Sprintf(`
			from(bucket:"%s")
				|> range(start: -1h)
				|> filter(fn: (r) => r._measurement == "http_check")
				|> filter(fn: (r) => r.target == "%s")
				|> filter(fn: (r) => r._field == "latency_ms" or r._field == "ssl_days_remaining" or r._field == "status_code")
				|> yield(name: "results")
		`, bucket, targetName)

		result, err := queryAPI.Query(context.Background(), query)
		if err != nil {
			log.Printf("Query error: %v\n", err)
			http.Error(w, "Database query failed", http.StatusInternalServerError)
			return
		}

		var metrics []MetricData
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
	log.Println("Initializing Proactive Infrastructure Monitor")

	influxURL := os.Getenv("INFLUXDB_URL")
	if influxURL == "" {
		influxURL = "http://localhost:8086"
	}
	influxToken := os.Getenv("INFLUXDB_TOKEN")
	if influxToken == "" {
		log.Fatal("INFLUXDB_TOKEN is required in the environment variables")
	}

	// Initialize InfluxDB V2 Client
	client := influxdb2.NewClientWithOptions(influxURL, influxToken, influxdb2.DefaultOptions().SetBatchSize(20))
	defer client.Close()

	// Test connection
	_, err := client.Health(context.Background())
	if err != nil {
		log.Fatalf("Cannot connect to InfluxDB at %s : %v", influxURL, err)
	}
	log.Println("Successfully connected to InfluxDB \u2705")

	org := os.Getenv("INFLUXDB_ORG")
	bucket := os.Getenv("INFLUXDB_BUCKET")
	writeAPI := client.WriteAPI(org, bucket)

	// Catch application errors and force flush on exit
	defer writeAPI.Flush()

	// Launch async polling monitor map
	go startMonitor(writeAPI)

	// Expose HTTP Handlers (Blocking)
	startAPI(client)
}
