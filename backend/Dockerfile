FROM golang:1.21-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod ./
COPY main.go ./

RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -o monitor_binary main.go

FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

COPY --from=builder /app/monitor_binary .

EXPOSE 8080

CMD ["./monitor_binary"]
