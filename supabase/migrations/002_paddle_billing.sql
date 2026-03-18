-- Paddle billing support and idempotent order fulfillment

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS paddle_transaction_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_orders_payment_provider ON public.orders(payment_provider);
CREATE INDEX IF NOT EXISTS idx_orders_paddle_transaction_id ON public.orders(paddle_transaction_id);

CREATE OR REPLACE FUNCTION public.complete_credit_order(
  p_order_id UUID,
  p_user_id UUID,
  p_credits INTEGER,
  p_provider TEXT,
  p_transaction_id TEXT
)
RETURNS TABLE(completed BOOLEAN, balance_after INTEGER) AS $$
DECLARE
  v_status TEXT;
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  SELECT status INTO v_status
  FROM public.orders
  WHERE id = p_order_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER;
    RETURN;
  END IF;

  IF v_status <> 'pending' THEN
    SELECT credits INTO v_current_balance
    FROM public.profiles
    WHERE id = p_user_id;

    RETURN QUERY SELECT FALSE, v_current_balance;
    RETURN;
  END IF;

  SELECT credits INTO v_current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %', p_user_id;
  END IF;

  v_new_balance := v_current_balance + p_credits;

  UPDATE public.orders
  SET
    status = 'completed',
    payment_provider = p_provider,
    paddle_transaction_id = COALESCE(p_transaction_id, paddle_transaction_id)
  WHERE id = p_order_id;

  UPDATE public.profiles
  SET credits = v_new_balance
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    order_id,
    description
  ) VALUES (
    p_user_id,
    'charge',
    p_credits,
    v_new_balance,
    p_order_id,
    'Purchased ' || p_credits || ' credits'
  );

  RETURN QUERY SELECT TRUE, v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
