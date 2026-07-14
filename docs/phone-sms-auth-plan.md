# Phone SMS Authentication Plan

## Goal

Add mainland China (`+86`) phone OTP login while keeping Google login, and let an already signed-in Google user bind or change a verified phone number without creating a second account.

## Architecture

- Supabase Auth remains the source of truth for users, OTP verification, identities, and sessions.
- Supabase's HTTP Send SMS Hook forwards each OTP to Alibaba Cloud SMS.
- The hook verifies the Standard Webhooks signature against the raw request body before parsing JSON.
- Alibaba Cloud `SendSms` is called once with a 2-second timeout and no automatic retry.
- Verified phone data is read from Supabase `User.phone` and `phone_confirmed_at`; it is not copied into `profiles`.

## Strictly Separate User Flows

### Signed-out login or signup

1. Normalize and validate a mainland China mobile number.
2. Complete a real CAPTCHA challenge.
3. Call `signInWithOtp({ phone, options: { captchaToken } })`.
4. Verify with `verifyOtp({ phone, token, type: "sms" })`.

### Signed-in phone binding or change

1. Normalize and validate a mainland China mobile number.
2. Call `updateUser({ phone })` while the Google session is active.
3. Verify with `verifyOtp({ phone, token, type: "phone_change" })`.
4. Refresh the current user and confirm that its UID is unchanged.

The signed-in flow must never call `signInWithOtp`. Both send and verify operations re-read the authenticated user from Supabase, so a stale client store cannot cross the flow boundary. Phone numbers already owned by another user are rejected with safe copy; accounts are never merged automatically.

## Hook Security and Delivery Semantics

- Accept only signed POST requests and reject missing, invalid, malformed, oversized, or non-`+86` payloads.
- Keep the raw request body only in memory for signature verification; never log or persist it.
- Never log or persist OTP values or full phone numbers.
- Reserve `webhook-id` and enforce a per-phone limit atomically in `sms_delivery_attempts` before calling Alibaba Cloud.
- Store only an HMAC phone hash, delivery status, provider request ID/error code, and timestamps.
- Treat duplicate webhook IDs as already handled so a retry cannot trigger a second Alibaba call.
- Return `200 {}` only for Alibaba `Code === "OK"` or a duplicate reservation.
- Return non-retryable errors after any provider timeout/unknown result. Alibaba Cloud SMS is not idempotent, so strict exactly-once delivery is impossible at the provider timeout boundary.
- Keep the complete hook execution inside Supabase's five-second budget.

## Abuse Prevention

- Render Cloudflare Turnstile in the phone-login UI and pass its token to Supabase.
- Reset the challenge after every send attempt.
- Configure Supabase OTP expiry to five minutes and resend interval to 60 seconds.
- Configure Supabase Auth IP rate limits and project SMS quotas before enabling Phone Provider.
- The hook permits at most five provider attempts per HMAC phone hash in ten minutes, including the signed-in binding path.
- The public feature flag hides UI only. Emergency rollback must disable Supabase Phone Provider.

## Configuration

Client-visible:

- `NEXT_PUBLIC_PHONE_AUTH_ENABLED`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

Server-only:

- `SEND_SMS_HOOK_SECRETS`
- `SMS_AUDIT_HMAC_KEY`
- `ALIYUN_ACCESS_KEY_ID`
- `ALIYUN_ACCESS_KEY_SECRET`
- `ALIYUN_SMS_REGION=cn-hangzhou`
- `ALIYUN_SMS_SIGN_NAME`
- `ALIYUN_SMS_TEMPLATE_CODE`
- `ALIYUN_SMS_TEMPLATE_PARAM=code`

## Release Order

1. Apply migration `012_phone_auth.sql`.
2. Deploy the hook and keep the public phone-auth flag disabled.
3. Configure Turnstile, OTP expiry, resend interval, Auth rate limits, and SMS quotas.
4. Test signed hook requests and Alibaba test numbers, including timeouts and duplicate webhook IDs.
5. Configure the Supabase Send SMS Hook, then enable Phone Provider.
6. Verify new phone login, returning phone login, Google phone binding, duplicate-phone rejection, and UID continuity after logout/login.
7. Enable the public UI flag.

## Rollback

Disable Supabase Phone Provider first, then disable `NEXT_PUBLIC_PHONE_AUTH_ENABLED`. Keep the hook and audit records temporarily for incident analysis.

## Validation

- Unit tests: phone normalization/masking, flow separation, webhook signature handling, request validation, idempotency, provider success/failure/timeout.
- Static checks: ESLint and TypeScript.
- Regression: full test suite and production build.
- Runtime smoke tests: login prompt, resend countdown, phone-only user menu, settings binding, and light/dark responsive layouts.

External dashboard activation and live SMS delivery require the deployment's existing Supabase, Turnstile, and Alibaba Cloud credentials and are completed after the code is deployed.
