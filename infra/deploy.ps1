<#
.SYNOPSIS
    SIDECI Deployment & Quality Gate Orchestrator (MASTER INSTRUCTION v2.0 Compliant)
.DESCRIPTION
    Mengelola validasi kualitas, rencana rilis, sinkronisasi kredensial terpilah,
    pemeriksaan kesehatan layanan, deployment bertahap, serta rollback aman.
    Membaca konfigurasi publik dari infra/config.yaml dan rahasia lokal dari infra/credentials.env.

.EXAMPLE
    .\infra\deploy.ps1 validate           # Cek config, kebocoran secret Git, migrasi SQL, & build/typecheck
    .\infra\deploy.ps1 plan               # Tampilkan rencana topologi deployment tanpa eksekusi remote
    .\infra\deploy.ps1 status             # Health check layanan Backend, Frontend, & Docker VPS
    .\infra\deploy.ps1 secrets            # Sinkronisasi hanya secret & variable yang disetujui ke GitHub
    .\infra\deploy.ps1 setup              # Pemeriksaan kesiapan awal VPS, DB PostgreSQL, & Nginx
    .\infra\deploy.ps1 deploy-staging     # Jalankan workflow deployment ke lingkungan Staging
    .\infra\deploy.ps1 deploy-production  # Jalankan deployment Produksi (wajib konfirmasi eksplisit)
    .\infra\deploy.ps1 rollback           # Panduan & pemicu rollback kontainer ke rilis stabil sebelumnya
#>

param(
    [Parameter(Position = 0)]
    [ValidateSet("status", "validate", "plan", "secrets", "setup", "deploy-staging", "deploy-production", "rollback")]
    [string]$Action = "status"
)

$ErrorActionPreference = "Stop"
$ROOT = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { (Get-Location).Path }

function Write-Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "   [OK]   $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "   [WARN] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "   [FAIL] $msg" -ForegroundColor Red }

function Load-Config {
    $configFile = Join-Path $ROOT "infra\config.yaml"
    if (-not (Test-Path $configFile)) {
        Write-Fail "infra/config.yaml tidak ditemukan."
        exit 1
    }
    $cfg = @{}
    $section = ""
    $subsection = ""
    foreach ($line in (Get-Content $configFile)) {
        if ($line -match "^\s*#" -or $line.Trim() -eq "") { continue }
        if ($line -match "^([a-zA-Z0-9_]+):\s*$") {
            $section = $Matches[1]; $subsection = ""; continue
        }
        if ($line -match "^  ([a-zA-Z0-9_]+):\s*$") {
            $subsection = $Matches[1]; continue
        }
        if ($line -match "^\s+-\s+(.+)$") {
            $val = ($Matches[1] -split "#")[0].Trim().Trim('"').Trim("'")
            $listKey = if ($subsection) { "${section}.${subsection}.list" } else { "${section}.list" }
            if (-not $cfg[$listKey]) { $cfg[$listKey] = @() }
            $cfg[$listKey] += $val
            continue
        }
        if ($line -match "^    ([a-zA-Z0-9_]+):\s*(.+)$") {
            $k = $Matches[1].Trim()
            $v = ($Matches[2] -split "#")[0].Trim().Trim('"').Trim("'")
            if ($subsection) { $cfg["${section}.${subsection}.${k}"] = $v }
            else              { $cfg["${section}.${k}"] = $v }
            continue
        }
        if ($line -match "^  ([a-zA-Z0-9_]+):\s*(.+)$") {
            $k = $Matches[1].Trim()
            $v = ($Matches[2] -split "#")[0].Trim().Trim('"').Trim("'")
            $cfg["${section}.${k}"] = $v
            $subsection = ""
            continue
        }
    }
    return $cfg
}

function Load-Credentials {
    $credFile = Join-Path $ROOT "infra\credentials.env"
    if (-not (Test-Path $credFile)) {
        Write-Fail "infra/credentials.env belum ada. Salin dari infra/credentials.env.example terlebih dahulu."
        exit 1
    }
    $creds = @{}
    foreach ($raw in (Get-Content $credFile)) {
        $line = $raw.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $parts = $line -split "=", 2
            if ($parts.Count -eq 2) {
                $creds[$parts[0].Trim()] = $parts[1].Trim()
            }
        }
    }
    return $creds
}

function Invoke-Validate {
    Write-Step "Menjalankan Quality & Security Validation Gates..."
    $cfg = Load-Config
    Write-Ok "infra/config.yaml terbaca untuk project '$($cfg['project.name'])'"

    # 1. Cek tidak ada file rahasia atau dump PII yang terlacak Git
    Push-Location $ROOT
    try {
        $tracked = git ls-files 2>$null
        $forbidden = $tracked | Select-String -Pattern "(credentials\.env|service-account.*\.json|\.jks$|\.pem$|\.key$|db_sideci\.sql|Data_Kependudukan.*\.xlsx)"
        if ($forbidden) {
            Write-Fail "Ditemukan file sensitif/PII yang terlacak di Git! Batalkan sebelum commit/deploy."
            exit 1
        }
        Write-Ok "Git Secret & PII Guard bersih (0 file sensitif terlacak)"
    } finally {
        Pop-Location
    }

    # 2. Cek kelengkapan migrasi SQL (pasangan .up.sql dan .down.sql)
    $migDir = Join-Path $ROOT "backend\migrations"
    $upFiles = Get-ChildItem -Path $migDir -Filter "*.up.sql" -ErrorAction SilentlyContinue
    if (-not $upFiles -or $upFiles.Count -eq 0) {
        Write-Fail "Tidak ditemukan file migrasi *.up.sql di backend/migrations"
        exit 1
    }
    foreach ($up in $upFiles) {
        $downName = $up.Name -replace "\.up\.sql$", ".down.sql"
        if (-not (Test-Path (Join-Path $migDir $downName))) {
            Write-Fail "Migrasi $($up.Name) tidak memiliki pasangan rollback $downName"
            exit 1
        }
    }
    Write-Ok "Migrasi SQL terverifikasi ($($upFiles.Count) pasang .up.sql / .down.sql)"

    # 3. Cek Backend Golang bila toolchain tersedia
    $goBin = if (Get-Command go -ErrorAction SilentlyContinue) { "go" } elseif (Test-Path "C:\Program Files\Go\bin\go.exe") { "C:\Program Files\Go\bin\go.exe" } else { $null }
    if ($goBin) {
        Push-Location (Join-Path $ROOT "backend")
        try {
            & $goBin vet ./...
            if ($LASTEXITCODE -ne 0) { Write-Fail "go vet gagal"; exit 1 }
            Write-Ok "Backend Golang: go vet lulus"
        } finally { Pop-Location }
    } else {
        Write-Warn "Toolchain 'go' belum terpasang di PATH lokal — pemeriksaan kompilasi Go akan dijalankan di Docker/CI."
    }

    # 4. Cek Frontend TypeScript bila node_modules tersedia
    $feDir = Join-Path $ROOT "frontend"
    if (Test-Path (Join-Path $feDir "node_modules")) {
        Push-Location $feDir
        try {
            npm run typecheck
            if ($LASTEXITCODE -ne 0) { Write-Fail "Frontend npm run typecheck gagal"; exit 1 }
            Write-Ok "Frontend Next.js: TypeScript typecheck lulus"
        } finally { Pop-Location }
    } else {
        Write-Warn "frontend/node_modules belum terpasang — jalankan 'npm install' di folder frontend."
    }
}

function Invoke-Plan {
    Write-Step "Rencana Topologi Deployment SIDECI (Dry-Run)"
    $cfg = Load-Config
    Write-Host "   Project          : $($cfg['project.name']) (Pilot: $($cfg['project.pilot_tenant']))"
    Write-Host "   VPS Target       : $($cfg['vps.user'])@$($cfg['vps.host']) (Docker net: $($cfg['vps.docker_network']))"
    Write-Host "   [STAGING]" -ForegroundColor Yellow
    Write-Host "     - Frontend     : $($cfg['staging.frontend.container_name']) (Port $($cfg['staging.frontend.external_port']) -> 3000) | $($cfg['staging.frontend.pilot_url'])"
    Write-Host "     - Backend      : $($cfg['staging.backend.container_name'])  (Port $($cfg['staging.backend.external_port']) -> 8080) | $($cfg['staging.backend.domain'])"
    Write-Host "     - Database     : $($cfg['staging.backend.db_name']) @ $($cfg['vps.postgres_container'])"
    Write-Host "   [PRODUCTION]" -ForegroundColor Green
    Write-Host "     - Frontend     : $($cfg['production.frontend.container_name']) (Port $($cfg['production.frontend.external_port']) -> 3000) | $($cfg['production.frontend.pilot_url'])"
    Write-Host "     - Backend      : $($cfg['production.backend.container_name'])  (Port $($cfg['production.backend.external_port']) -> 8080) | $($cfg['production.backend.domain'])"
    Write-Host "     - Database     : $($cfg['production.backend.db_name']) @ $($cfg['vps.postgres_container'])"
}

function Invoke-Status {
    Write-Step "Memeriksa status layanan SIDECI..."
    $cfg = Load-Config
    $beHealth = $cfg["production.backend.health_url"]
    $feHealth = $cfg["production.frontend.health_url"]

    Write-Host "`n   [Production Backend]"
    try {
        $res = Invoke-RestMethod -Uri $beHealth -TimeoutSec 8
        Write-Ok "Backend aktif ($beHealth) -> status=$($res.status)"
    } catch {
        Write-Warn "Backend belum dapat dijangkau di $beHealth (normal jika belum di-deploy)"
    }

    Write-Host "`n   [Production Pilot Portal]"
    try {
        $code = curl.exe -s -o NUL -w "%{http_code}" --max-time 8 "$feHealth" 2>$null
        if ($code -eq "200") { Write-Ok "Portal Desa Ringdikit HTTP 200 ($feHealth)" }
        else { Write-Warn "Portal merespons HTTP $code ($feHealth)" }
    } catch {
        Write-Warn "Portal belum dapat dijangkau di $feHealth"
    }
}

function Invoke-Secrets {
    Write-Step "Sinkronisasi Secret & Variable Terpilah ke GitHub..."
    $cfg   = Load-Config
    $creds = Load-Credentials

    # Non-secret disimpan sebagai GitHub Actions Variables (bukan Secrets)
    gh variable set VPS_HOST --body $cfg["vps.host"]
    gh variable set VPS_USER --body $cfg["vps.user"]
    gh variable set API_BASE_URL --body $cfg["api.base_url"]
    Write-Ok "GitHub Variables (VPS_HOST, VPS_USER, API_BASE_URL) diperbarui"

    # Hanya sinkronisasi daftar kredensial yang disetujui secara eksplisit (tanpa mencetak nilainya!)
    $approvedSecretKeys = @(
        "DATABASE_URL_PROD",
        "DATABASE_URL_STAGING",
        "JWT_SECRET_KEY_PROD",
        "JWT_SECRET_KEY_STAGING",
        "STORAGE_ACCESS_KEY",
        "STORAGE_SECRET_KEY",
        "CLOUDFLARE_API_TOKEN"
    )
    foreach ($key in $approvedSecretKeys) {
        if ($creds.ContainsKey($key) -and $creds[$key] -and -not $creds[$key].StartsWith("<")) {
            $creds[$key] | gh secret set $key
            Write-Ok "GitHub Secret disinkronkan: $key"
        } else {
            Write-Warn "Lewati $key (belum diisi atau masih placeholder)"
        }
    }

    if ($creds.ContainsKey("VPS_SSH_KEY_PATH") -and $creds["VPS_SSH_KEY_PATH"]) {
        $sshPath = $creds["VPS_SSH_KEY_PATH"] -replace "^~", $env:USERPROFILE
        if (Test-Path $sshPath) {
            Get-Content $sshPath -Raw | gh secret set VPS_SSH_KEY
            Write-Ok "GitHub Secret disinkronkan: VPS_SSH_KEY"
        } else {
            Write-Warn "File SSH key tidak ditemukan di path yang dikonfigurasi"
        }
    }
}

function Invoke-Setup {
    Write-Step "Memeriksa kesiapan VPS, PostgreSQL, dan Nginx (Read-Only Check)..."
    $cfg = Load-Config
    $vpsUser = $cfg["vps.user"]
    $vpsHost = $cfg["vps.host"]
    $pgContainer = $cfg["vps.postgres_container"]
    $dbProd = $cfg["production.backend.db_name"]
    $dbStg  = $cfg["staging.backend.db_name"]

    ssh -o ConnectTimeout=10 "${vpsUser}@${vpsHost}" @"
        echo '--- Docker Engine ---'
        docker --version
        echo '--- Shared PostgreSQL Container ---'
        docker ps --filter name=$pgContainer --format '{{.Names}}: {{.Status}}'
        echo '--- Cek Database Staging ($dbStg) & Prod ($dbProd) ---'
        docker exec $pgContainer psql -U postgres -tc "SELECT datname FROM pg_database WHERE datname IN ('$dbStg', '$dbProd');"
"@
    Write-Ok "Pemeriksaan kesiapan VPS selesai."
}

function Invoke-DeployStaging {
    Invoke-Validate
    Write-Step "Memicu workflow deployment ke STAGING..."
    gh workflow run deploy.yml -f target_env=staging -f service=all
    Write-Ok "Workflow deploy.yml (staging) berhasil dipicu. Pantau dengan: gh run watch"
}

function Invoke-DeployProduction {
    Invoke-Validate
    Invoke-Plan
    Write-Host "`nPERINGATAN: Anda akan melakukan deployment ke lingkungan PRODUCTION!" -ForegroundColor Yellow
    Write-Host "Pastikan Staging telah diverifikasi dan Pre-Production Security Gate telah lulus." -ForegroundColor Yellow
    $confirm = Read-Host "Ketik 'DEPLOY-PROD' untuk mengonfirmasi persetujuan rilis produksi"
    if ($confirm -cne "DEPLOY-PROD") {
        Write-Warn "Deployment produksi dibatalkan (konfirmasi tidak sesuai)."
        exit 1
    }
    gh workflow run deploy.yml -f target_env=production -f service=all
    Write-Ok "Workflow deploy.yml (production) berhasil dipicu. Pantau dengan: gh run watch"
}

function Invoke-Rollback {
    $cfg = Load-Config
    Write-Step "Prosedur Rollback Aman SIDECI"
    Write-Host "1. Identifikasi tag image stabil sebelumnya di VPS ($($cfg['vps.user'])@$($cfg['vps.host']))."
    Write-Host "2. Kembalikan tag kontainer pada ~/app/sideci-prod/docker-compose.yml lalu jalankan 'docker compose up -d'."
    Write-Host "3. Jika migrasi skema perlu dibatalkan, jalankan langkah tunggal: migrate -path ./migrations -database `$DATABASE_URL down 1"
    Write-Host "4. Verifikasi kembali dengan: .\infra\deploy.ps1 status"
}

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "  SIDECI Infrastructure & Deploy Orchestrator" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

switch ($Action) {
    "status"            { Invoke-Status }
    "validate"          { Invoke-Validate }
    "plan"              { Invoke-Plan }
    "secrets"           { Invoke-Secrets }
    "setup"             { Invoke-Setup }
    "deploy-staging"    { Invoke-DeployStaging }
    "deploy-production" { Invoke-DeployProduction }
    "rollback"          { Invoke-Rollback }
}
