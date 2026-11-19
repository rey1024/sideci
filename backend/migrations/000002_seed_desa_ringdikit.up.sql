-- ============================================================================
-- SIDECI Migration 000002: Seed Roles & Pilot Tenant (Desa Ringdikit)
-- ============================================================================

INSERT INTO roles (code, display_name, description) VALUES
    ('superadmin', 'Superadmin Platform', 'Pengelola pusat multi-desa SIDECI'),
    ('admin_desa', 'Admin Profil & Pengaturan Desa', 'Pengelola profil landing page, dusun, dan akun staf desa'),
    ('operator_kependudukan', 'Operator Kependudukan Desa', 'Manajemen KK/penduduk dan validator laporan Kepala Dusun'),
    ('operator_persuratan', 'Operator Persuratan Desa', 'Pembuatan surat multi-NIK, QR verifikasi, dan arsip surat sah'),
    ('kepala_dusun', 'Operator Kepala Dusun / Kelian Banjar', 'Input warga & pelaporan peristiwa khusus dusun tugasnya'),
    ('kepala_desa', 'Kepala Desa / Perbekel (Eksekutif)', 'Akses analitik dan statistik eksekutif desa')
ON CONFLICT (code) DO NOTHING;

WITH inserted_village AS (
    INSERT INTO villages (
        code_bps, slug, custom_domain, name, district_name, regency_name, province_name,
        postal_code, leader_title, leader_name, hamlet_term, hamlet_leader_term,
        office_address, office_phone, office_email, profile_config, letter_config
    ) VALUES (
        '51.08.02.2004',
        'ringdikit',
        'ringdikit.desa.id',
        'Ringdikit',
        'Seririt',
        'Kabupaten Buleleng',
        'Bali',
        '81153',
        'Perbekel',
        'I Made Sumadi',
        'Banjar Dinas',
        'Kelian Banjar Dinas',
        'Jalan Raya Seririt - Pupuan, Desa Ringdikit',
        '+62 878 5875 5564',
        'desaringdikit@gmail.com',
        '{"welcome_quote": "Mewujudkan pelayanan warga Desa Ringdikit yang cepat, transparan, tertib administrasi kependudukan, dan berbasis data akurat dari tiap Banjar Dinas."}'::jsonb,
        '{"number_pattern": "{kode}/{urut}/{bulan_romawi}/{tahun}"}'::jsonb
    )
    ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
    RETURNING id
)
INSERT INTO dusuns (village_id, name, head_name)
SELECT id, d.name, d.head_name
FROM inserted_village,
LATERAL (VALUES
    ('Kajanan', 'Kelian Banjar Kajanan'),
    ('Kelodan', 'Kelian Banjar Kelodan'),
    ('Kuwum', 'Kelian Banjar Kuwum'),
    ('Rawa', 'Kelian Banjar Rawa'),
    ('Sari Mekar', 'Kelian Banjar Sari Mekar')
) AS d(name, head_name)
ON CONFLICT (village_id, name) DO NOTHING;

INSERT INTO letter_templates (village_id, code, title, classification_code, schema_config)
SELECT v.id, t.code, t.title, t.classification_code, t.schema_config::jsonb
FROM villages v,
LATERAL (VALUES
    ('SK_UMUM', 'Surat Keterangan Umum / Pengantar', '147', '{"entities": ["applicant_nik"], "fields": ["pengantar_banjar", "keterangan", "keperluan"]}'),
    ('SK_KELAHIRAN', 'Surat Keterangan Kelahiran', '474.1', '{"entities": ["mother_nik", "father_nik"], "fields": ["nama_anak", "anak_ke", "tgl_lahir_anak", "penolong_kelahiran", "alamat_penolong"]}'),
    ('SK_KEMATIAN', 'Surat Keterangan Kematian', '474.3', '{"entities": ["deceased_nik"], "fields": ["nama_pelapor", "hubungan_pelapor", "hari_wafat", "tgl_wafat", "tempat_wafat", "sebab_wafat"], "triggers_event": "DEATH"}'),
    ('SK_BEDA_NAMA', 'Surat Keterangan Beda Nama', '470', '{"entities": ["applicant_nik"], "repeatable": "dokumen_pembanding"}'),
    ('SK_WARIS', 'Surat Keterangan Ahli Waris', '470', '{"entities": ["deceased_nik"], "repeatable_niks": "ahli_waris"}')
) AS t(code, title, classification_code, schema_config)
WHERE v.slug = 'ringdikit'
ON CONFLICT (village_id, code) DO NOTHING;
