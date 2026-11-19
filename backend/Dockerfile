FROM golang:alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/ ./cmd/
COPY internal/ ./internal/
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/sideci-api ./cmd/api && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/sideci-seed ./cmd/seed-prod

FROM alpine:3.20
RUN adduser -D -g '' appuser && apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=builder /out/sideci-api /app/sideci-api
COPY --from=builder /out/sideci-seed /app/sideci-seed
COPY migrations/ /app/migrations/
RUN mkdir -p /app/storage/letters && chown -R appuser:appuser /app/storage
USER appuser
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:8080/health || exit 1
ENTRYPOINT ["/app/sideci-api"]
