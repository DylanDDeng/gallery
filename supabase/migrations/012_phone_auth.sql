-- Phone authentication SMS delivery audit.
-- Verified phone numbers remain in auth.users and are intentionally not copied
-- into public.profiles.

CREATE TABLE IF NOT EXISTS public.sms_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT NOT NULL UNIQUE CHECK (webhook_id <> ''),
  phone_hash TEXT NOT NULL CHECK (phone_hash ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL CHECK (status IN ('pre_send', 'provider_attempted', 'completed', 'failed')),
  provider_code TEXT,
  provider_request_id TEXT,
  provider_message_id TEXT,
  provider_attempted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sms_delivery_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.sms_delivery_attempts FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_sms_delivery_attempts_created_at
  ON public.sms_delivery_attempts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_delivery_attempts_phone_window
  ON public.sms_delivery_attempts (phone_hash, created_at DESC);

DROP TRIGGER IF EXISTS update_sms_delivery_attempts_updated_at
  ON public.sms_delivery_attempts;
CREATE TRIGGER update_sms_delivery_attempts_updated_at
  BEFORE UPDATE ON public.sms_delivery_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reserve a delivery id and enforce a per-phone limit in one transaction.
-- The initial status is provider_attempted because, once this transaction
-- commits, the application may call the non-idempotent provider immediately.
CREATE OR REPLACE FUNCTION public.reserve_sms_delivery_attempt(
  p_webhook_id TEXT,
  p_phone_hash TEXT
)
RETURNS TABLE(outcome TEXT, existing_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_recent_attempts INTEGER;
BEGIN
  IF p_webhook_id IS NULL OR p_webhook_id = '' OR p_phone_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid sms delivery reservation';
  END IF;

  -- Serialize different webhook ids for the same HMAC phone hash so concurrent
  -- requests cannot race past the rate limit.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_phone_hash, 0));

  SELECT status INTO v_status
  FROM public.sms_delivery_attempts
  WHERE webhook_id = p_webhook_id;

  IF FOUND THEN
    RETURN QUERY SELECT 'duplicate'::TEXT, v_status;
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_recent_attempts
  FROM public.sms_delivery_attempts
  WHERE phone_hash = p_phone_hash
    AND created_at >= NOW() - INTERVAL '10 minutes'
    AND status IN ('provider_attempted', 'completed', 'failed');

  IF v_recent_attempts >= 5 THEN
    RETURN QUERY SELECT 'rate_limited'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.sms_delivery_attempts (
    webhook_id,
    phone_hash,
    status,
    provider_attempted_at
  ) VALUES (
    p_webhook_id,
    p_phone_hash,
    'provider_attempted',
    NOW()
  );

  RETURN QUERY SELECT 'reserved'::TEXT, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_sms_delivery_attempt(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_sms_delivery_attempt(TEXT, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.prune_sms_delivery_attempts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.sms_delivery_attempts
  WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_sms_delivery_attempts()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_sms_delivery_attempts()
  TO service_role;
