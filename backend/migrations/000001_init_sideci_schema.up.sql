-- ============================================================================
-- SIDECI Migration 000001: Core Multi-Tenant Schema (PostgreSQL 16+)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. Villages (Tenants)
CREATE TABLE villages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_bps        VARCHAR(20) UNIQUE,
    slug            VARCHAR(80) NOT NULL UNIQUE,
    custom_domain   VARCHAR(190) UNIQUE,
    name            VARCHAR(150) NOT NULL,
    district_name   VARCHAR(150) NOT NULL,
    regency_name    VARCHAR(150) NOT NULL,
    province_name   VARCHAR(150) NOT NULL,
    postal_code     VARCHAR(10),
    leader_title    VARCHAR(60) NOT NULL DEFAULT 'Kepala Desa',
    leader_name     VARCHAR(150) NOT NULL,
    leader_photo_url TEXT,
    hamlet_term     VARCHAR(60) NOT NULL DEFAULT 'Dusun',
    hamlet_leader_term VARCHAR(80) NOT NULL DEFAULT 'Kepala Dusun',
    office_address  TEXT,
    office_phone    VARCHAR(40),
    office_email    VARCHAR(150),
    profile_config  JSONB NOT NULL DEFAULT '{}'::jsonb,
    letter_config   JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Dusuns / Banjar Dinas
CREATE TABLE dusuns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id      UUID NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,
    head_name       VARCHAR(150),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (village_id, name)
);
CREATE INDEX idx_dusuns_village ON dusuns(village_id);

-- 3. Roles & Users (Multi-Role RBAC)
CREATE TABLE roles (
    code            VARCHAR(50) PRIMARY KEY,
    display_name    VARCHAR(100) NOT NULL,
    description     TEXT
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id      UUID REFERENCES villages(id) ON DELETE CASCADE,
    dusun_id        UUID REFERENCES dusuns(id) ON DELETE SET NULL,
    username        VARCHAR(100) NOT NULL UNIQUE,
    full_name       VARCHAR(150) NOT NULL,
    email           VARCHAR(150),
    phone           VARCHAR(30),
    password_hash   TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_village ON users(village_id);

CREATE TABLE user_roles (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_code       VARCHAR(50) NOT NULL REFERENCES roles(code) ON DELETE RESTRICT,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_code)
);

-- 4. Households (Kartu Keluarga) & Residents (Penduduk)
CREATE TABLE households (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id      UUID NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
    dusun_id        UUID REFERENCES dusuns(id) ON DELETE SET NULL,
    no_kk           CHAR(16) NOT NULL,
    address         TEXT NOT NULL,
    rt              VARCHAR(10),
    rw              VARCHAR(10),
    postal_code     VARCHAR(10),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (village_id, no_kk)
);
CREATE INDEX idx_households_village_dusun ON households(village_id, dusun_id);

CREATE TABLE residents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id      UUID NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
    household_id    UUID REFERENCES households(id) ON DELETE SET NULL,
    dusun_id        UUID REFERENCES dusuns(id) ON DELETE SET NULL,
    nik             CHAR(16) NOT NULL,
    full_name       VARCHAR(180) NOT NULL,
    gender          CHAR(1) NOT NULL CHECK (gender IN ('L', 'P')),
    birth_place     VARCHAR(120) NOT NULL,
    birth_date      DATE NOT NULL,
    blood_type      VARCHAR(5) DEFAULT '-',
    religion        VARCHAR(40) NOT NULL,
    marital_status  VARCHAR(40) NOT NULL,
    shdk            VARCHAR(50) NOT NULL,
    education       VARCHAR(80),
    occupation      VARCHAR(120),
    citizenship     VARCHAR(40) NOT NULL DEFAULT 'WNI',
    father_name     VARCHAR(180),
    mother_name     VARCHAR(180),
    civil_docs      JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          VARCHAR(30) NOT NULL DEFAULT 'AKTIF'
                    CHECK (status IN ('AKTIF', 'MENINGGAL', 'PINDAH_KELUAR', 'TIDAK_AKTIF')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (village_id, nik)
);
CREATE INDEX idx_residents_village_dusun ON residents(village_id, dusun_id);
CREATE INDEX idx_residents_village_status ON residents(village_id, status);
CREATE INDEX idx_residents_name_trgm ON residents USING GIN (full_name gin_trgm_ops);

-- 5. Maker-Checker Submissions (Kepala Dusun -> Operator Kependudukan)
CREATE TABLE population_submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id      UUID NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
    dusun_id        UUID NOT NULL REFERENCES dusuns(id) ON DELETE RESTRICT,
    resident_id     UUID REFERENCES residents(id) ON DELETE SET NULL,
    submission_type VARCHAR(40) NOT NULL
                    CHECK (submission_type IN ('NEW_RESIDENT', 'UPDATE_BIODATA', 'BIRTH', 'DEATH', 'MARRIAGE', 'DIVORCE', 'MOVE_IN', 'MOVE_OUT')),
    payload_before  JSONB,
    payload_after   JSONB NOT NULL,
    attachment_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    status          VARCHAR(30) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'APPROVED', 'REVISION_REQUESTED', 'REJECTED')),
    submitted_by    UUID NOT NULL REFERENCES users(id),
    reviewed_by     UUID REFERENCES users(id),
    review_notes    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ
);
CREATE INDEX idx_submissions_village_status ON population_submissions(village_id, status);
CREATE INDEX idx_submissions_dusun ON population_submissions(village_id, dusun_id);

-- 6. Immutable Resident Lifecycle History (Historis Mutasi Penduduk)
CREATE TABLE population_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id      UUID NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
    resident_id     UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
    submission_id   UUID REFERENCES population_submissions(id) ON DELETE SET NULL,
    event_type      VARCHAR(40) NOT NULL,
    event_date      DATE NOT NULL,
    summary         TEXT NOT NULL,
    event_metadata  JSONB NOT NULL DEFAULT '{}'::jsonb,
    recorded_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_events_resident ON population_events(village_id, resident_id, event_date DESC);

-- 7. Letter Templates & Letter Requests (Persuratan Multi-NIK & QR Hybrid)
CREATE TABLE letter_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id      UUID NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
    code            VARCHAR(50) NOT NULL,
    title           VARCHAR(160) NOT NULL,
    classification_code VARCHAR(30) NOT NULL DEFAULT '147',
    schema_config   JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (village_id, code)
);

CREATE TABLE letter_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id          UUID NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
    template_id         UUID NOT NULL REFERENCES letter_templates(id) ON DELETE RESTRICT,
    ticket_code         VARCHAR(40) NOT NULL UNIQUE,
    letter_number       VARCHAR(80),
    applicant_resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
    applicant_wa        VARCHAR(30),
    source              VARCHAR(20) NOT NULL DEFAULT 'WALK_IN'
                        CHECK (source IN ('PUBLIC_FORM', 'WALK_IN')),
    purpose             TEXT NOT NULL,
    dynamic_payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    status              VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED'
                        CHECK (status IN ('SUBMITTED', 'VERIFIED', 'AWAITING_SIGNATURE', 'COMPLETED', 'REJECTED')),
    verify_qr_token     VARCHAR(80) NOT NULL UNIQUE,
    draft_pdf_key       TEXT,
    signed_pdf_key      TEXT,
    processed_by        UUID REFERENCES users(id),
    issued_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_letters_village_status ON letter_requests(village_id, status, created_at DESC);

-- 8. Sanitized Audit Logs (Tanpa Kredensial/Rahasia)
CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    village_id      UUID REFERENCES villages(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(80) NOT NULL,
    entity_type     VARCHAR(60) NOT NULL,
    entity_id       VARCHAR(80),
    ip_address      VARCHAR(50),
    sanitized_diff  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_village_created ON audit_logs(village_id, created_at DESC);
