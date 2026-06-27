-- دلو الفيديو (خاص) — شغّله في Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('academy-videos', 'academy-videos', false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
