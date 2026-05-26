FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod ./
RUN apk add --no-cache git
RUN go mod tidy

COPY . .
# We build specifying the files directly for the binary
RUN CGO_ENABLED=0 GOOS=linux go build -o monitor_binary main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /root/
COPY --from=builder /app/monitor_binary .

EXPOSE 8080
CMD ["./monitor_binary"]
