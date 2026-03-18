-- Provider-neutral order fulfillment for Stripe and Paddle

CREATE OR REPLACE FUNCTION public.complete_credit_order_v2(
  p_order_id UUID,
  p_user_id UUID,
  p_credits INTEGER,
  p_provider TEXT,
  p_provider_checkout_id TEXT DEFAULT NULL,
  p_provider_payment_intent_id TEXT DEFAULT NULL
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
    stripe_session_id = CASE
      WHEN p_provider = 'stripe' THEN COALESCE(p_provider_checkout_id, stripe_session_id)
      ELSE stripe_session_id
    END,
    stripe_payment_intent_id = CASE
      WHEN p_provider = 'stripe' THEN COALESCE(p_provider_payment_intent_id, stripe_payment_intent_id)
      ELSE stripe_payment_intent_id
    END,
    paddle_transaction_id = CASE
      WHEN p_provider = 'paddle' THEN COALESCE(p_provider_checkout_id, paddle_transaction_id)
      ELSE paddle_transaction_id
    END
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
