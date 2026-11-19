# SIDECI Backend API (Golang + PostgreSQL + `golang-migrate`)

Layanan REST API *multi-tenant* untuk **SIDECI**, dirancang ringan, *stateless*, dan siap melayani **Next.js Web** maupun **Flutter Mobile** (Fase 3).

## Menjalankan Secara Lokal

```powershell
Copy-Item .env.example .env
go run ./cmd/api
```

## Menjalankan Migrasi Database (`golang-migrate`)

```powershell
# Terapkan migrasi ke atas (Up)
migrate -path ./migrations -database "postgres://sideci:sideci_local_dev_only@localhost:5432/sideci_dev?sslmode=disable" up

# Rollback 1 langkah (Down)
migrate -path ./migrations -database "postgres://sideci:sideci_local_dev_only@localhost:5432/sideci_dev?sslmode=disable" down 1
```

## Menjalankan Pengujian

```powershell
go vet ./...
go test -v ./...
```
