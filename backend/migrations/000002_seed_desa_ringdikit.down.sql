DELETE FROM villages WHERE slug = 'ringdikit';
DELETE FROM roles WHERE code IN (
    'superadmin',
    'admin_desa',
    'operator_kependudukan',
    'operator_persuratan',
    'kepala_dusun',
    'kepala_desa'
);
