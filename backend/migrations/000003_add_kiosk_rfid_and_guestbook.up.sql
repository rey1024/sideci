-- =============================================================================
-- SIDECI Migration 000003: Anjungan Kiosk Mandiri, Pemetaan RFID KTP-el, & Buku Tamu
-- =============================================================================

-- 1. Kolom rfid_uid pada tabel residents untuk pemetaan ID Tag RFID E-KTP <-> NIK
ALTER TABLE residents
    ADD COLUMN IF NOT EXISTS rfid_uid VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_village_rfid
    ON residents(village_id, UPPER(rfid_uid))
    WHERE rfid_uid IS NOT NULL AND rfid_uid <> '';

-- 2. Tabel Buku Tamu Digital Desa (guestbook_entries)
CREATE TABLE IF NOT EXISTS guestbook_entries (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id              UUID NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
    resident_id             UUID REFERENCES residents(id) ON DELETE SET NULL,
    identification_method   VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
                            CHECK (identification_method IN ('RFID', 'NIK', 'MANUAL')),
    rfid_uid                VARCHAR(64),
    nik                     VARCHAR(16),
    full_name               VARCHAR(180) NOT NULL,
    dusun_name              VARCHAR(120),
    address                 TEXT,
    phone                   VARCHAR(40),
    institution             VARCHAR(160),
    purpose_category        VARCHAR(80) NOT NULL DEFAULT 'Pelayanan Administrasi',
    purpose_detail          TEXT NOT NULL,
    target_official         VARCHAR(140) NOT NULL DEFAULT 'Perangkat Desa / Loket Pelayanan',
    checkin_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guestbook_village_checkin
    ON guestbook_entries(village_id, checkin_at DESC);

-- 3. Seed Pemetaan Awal Demo RFID E-KTP untuk 6 Warga Aktif Desa Ringdikit
--    agar fitur Scan RFID pada Kiosk siap langsung didemokan
WITH sample_residents AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY full_name ASC) AS rn
    FROM residents
    WHERE status = 'AKTIF'
      AND (rfid_uid IS NULL OR rfid_uid = '')
    LIMIT 6
)
UPDATE residents r
SET rfid_uid = '04A28F0' || sr.rn::text,
    updated_at = NOW()
FROM sample_residents sr
WHERE r.id = sr.id
  AND NOT EXISTS (
      SELECT 1 FROM residents r2
      WHERE r2.village_id = r.village_id
        AND UPPER(r2.rfid_uid) = '04A28F0' || sr.rn::text
  );
