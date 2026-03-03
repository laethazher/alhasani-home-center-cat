-- Add has_logo boolean field to vehicles table
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS has_logo BOOLEAN DEFAULT false;
