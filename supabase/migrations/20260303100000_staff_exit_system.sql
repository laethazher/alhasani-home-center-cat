-- ============================================================
-- Migration: Staff Exit System (إخراج الكادر)
-- Creates: staff_members, exit_requests tables + RLS + policies
-- ============================================================

-- 1) Staff Members table (drivers & assistants)
CREATE TABLE IF NOT EXISTS public.staff_members (
  id          BIGSERIAL PRIMARY KEY,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('driver', 'assistant')),
  city        TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2) Exit Requests table
CREATE TABLE IF NOT EXISTS public.exit_requests (
  id              BIGSERIAL PRIMARY KEY,
  driver_id       BIGINT REFERENCES public.staff_members(id),
  driver_name     TEXT NOT NULL,
  assistant_ids   BIGINT[] DEFAULT '{}',
  assistant_names TEXT[] DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'exited')),
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  approved_at     TIMESTAMPTZ,
  approved_by     UUID REFERENCES auth.users(id),
  exited_at       TIMESTAMPTZ,
  gate_guard_id   UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 3) Enable RLS
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exit_requests ENABLE ROW LEVEL SECURITY;

-- 4) RLS Policies for staff_members (read by anyone authenticated)
CREATE POLICY "staff_members: select for authenticated"
  ON public.staff_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "staff_members: admin manage"
  ON public.staff_members FOR ALL
  TO authenticated
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin'
  )
  WITH CHECK (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin'
  );

-- 5) RLS Policies for exit_requests
-- Everyone can read exit requests (gate_guard, admin, etc.)
CREATE POLICY "exit_requests: select for authenticated"
  ON public.exit_requests FOR SELECT
  TO authenticated
  USING (true);

-- Admin can insert exit requests
CREATE POLICY "exit_requests: admin insert"
  ON public.exit_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin'
  );

-- Admin can update exit requests (approve/reject)
CREATE POLICY "exit_requests: admin update"
  ON public.exit_requests FOR UPDATE
  TO authenticated
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin'
  )
  WITH CHECK (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin'
  );

-- Gate guard can update status to 'exited' only
CREATE POLICY "exit_requests: gate_guard confirm exit"
  ON public.exit_requests FOR UPDATE
  TO authenticated
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'gate_guard'
    AND status = 'approved'
  )
  WITH CHECK (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'gate_guard'
    AND status = 'exited'
  );

-- Admin can delete exit requests
CREATE POLICY "exit_requests: admin delete"
  ON public.exit_requests FOR DELETE
  TO authenticated
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin'
  );

-- 6) Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exit_requests_status ON public.exit_requests(status);
CREATE INDEX IF NOT EXISTS idx_exit_requests_created_at ON public.exit_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_members_role ON public.staff_members(role);
CREATE INDEX IF NOT EXISTS idx_staff_members_name ON public.staff_members(full_name);
