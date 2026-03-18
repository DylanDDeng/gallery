-- Refund credits for failed generation tasks in an idempotent way

CREATE OR REPLACE FUNCTION public.fail_generation_task_and_refund(
  p_user_id UUID,
  p_task_id UUID,
  p_error_message TEXT
)
RETURNS TABLE(refunded BOOLEAN, balance_after INTEGER) AS $$
DECLARE
  v_task_status TEXT;
  v_credits_cost INTEGER;
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  SELECT status, credits_cost
  INTO v_task_status, v_credits_cost
  FROM public.generation_tasks
  WHERE id = p_task_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.credit_transactions
    WHERE generation_task_id = p_task_id
      AND type = 'refund'
  ) THEN
    UPDATE public.generation_tasks
    SET status = 'failed', error_message = p_error_message
    WHERE id = p_task_id
      AND status <> 'completed';

    SELECT credits INTO v_current_balance
    FROM public.profiles
    WHERE id = p_user_id;

    RETURN QUERY SELECT FALSE, v_current_balance;
    RETURN;
  END IF;

  IF v_task_status NOT IN ('queued', 'processing') THEN
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

  v_new_balance := v_current_balance + COALESCE(v_credits_cost, 1);

  UPDATE public.profiles
  SET credits = v_new_balance
  WHERE id = p_user_id;

  UPDATE public.generation_tasks
  SET status = 'failed', error_message = p_error_message
  WHERE id = p_task_id;

  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    generation_task_id,
    description
  ) VALUES (
    p_user_id,
    'refund',
    COALESCE(v_credits_cost, 1),
    v_new_balance,
    p_task_id,
    'Refunded ' || COALESCE(v_credits_cost, 1) || ' credits for failed generation'
  );

  RETURN QUERY SELECT TRUE, v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
