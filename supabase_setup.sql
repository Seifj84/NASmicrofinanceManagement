-- ============================================================================
-- NAS MICROFINANCE MANAGEMENT (TZS) — SUPABASE CLOUD SYNC SETUP SCRIPT
-- Paste this into Supabase Dashboard -> SQL Editor -> Click "Run"
-- ============================================================================

-- 1. Real-Time Cross-Device Workspace Sync Table (PC <-> Phone Outside Local Network)
CREATE TABLE IF NOT EXISTS public.nas_cloud_state (
    id TEXT PRIMARY KEY DEFAULT 'global_workspace',
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security & allow authenticated/anon app clients with your project key
ALTER TABLE public.nas_cloud_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read/write sync for app clients" ON public.nas_cloud_state;
CREATE POLICY "Allow read/write sync for app clients"
    ON public.nas_cloud_state
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Enable Realtime broadcasts on nas_cloud_state
ALTER PUBLICATION supabase_realtime ADD TABLE public.nas_cloud_state;
