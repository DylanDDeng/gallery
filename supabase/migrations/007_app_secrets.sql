-- Private app secrets store for server-side provider credentials

CREATE TABLE IF NOT EXISTS public.app_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.app_secrets FROM anon, authenticated;

DROP TRIGGER IF EXISTS update_app_secrets_updated_at ON public.app_secrets;
CREATE TRIGGER update_app_secrets_updated_at
  BEFORE UPDATE ON public.app_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
