-- ============================================================
-- Fix: Cascading delete for maintenance records and related data
-- ============================================================

-- 1. Update maintenance_records to CASCADE on request_id delete
ALTER TABLE maintenance_records
DROP CONSTRAINT IF EXISTS maintenance_records_request_id_fkey,
ADD CONSTRAINT maintenance_records_request_id_fkey
  FOREIGN KEY (request_id)
  REFERENCES maintenance_requests(id)
  ON DELETE CASCADE;

-- 2. maintenance_images is already CASCADE in schema 20260310000000_maintenance_system.sql
-- (id REFERENCES maintenance_requests(id) ON DELETE CASCADE)
-- (id REFERENCES maintenance_records(id) ON DELETE CASCADE)

-- 3. spare_part_usage is already CASCADE in schema 20260310000000_maintenance_system.sql
-- (record_id REFERENCES maintenance_records(id) ON DELETE CASCADE)

-- This ensures that deleting a maintenance_request will:
-- a) Delete the linked maintenance_record (because of step 1)
-- b) Delete the linked maintenance_images (because of original schema)
-- c) Delete the linked spare_part_usage (because record is deleted)
