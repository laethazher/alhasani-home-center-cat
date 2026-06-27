-- =============================================================================
-- إعداد نهائي — شغّل بالترتيب في Supabase SQL Editor
-- https://supabase.com/dashboard/project/jxwzaoogmqzcqgnldwpm/sql/new
-- =============================================================================

-- [1] bootstrap (إن لم تُشغّله سابقاً)
-- انسخ محتوى: scripts/supabase-km-bootstrap.sql

-- [2] migration (إن لم تُشغّله سابقاً)
-- انسخ محتوى: prisma/migrations/20260627000000_init_km/migration.sql

-- [3] دلو الفيديو
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('academy-videos', 'academy-videos', false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- [4] البذور — انسخ محتوى: scripts/RUN_IN_SQL_EDITOR_seed.sql
