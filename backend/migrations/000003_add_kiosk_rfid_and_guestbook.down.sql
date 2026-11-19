DROP TABLE IF EXISTS guestbook_entries;
DROP INDEX IF EXISTS idx_residents_village_rfid;
ALTER TABLE residents DROP COLUMN IF EXISTS rfid_uid;
