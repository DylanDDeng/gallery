# Phone SMS Authentication Setup

The implementation is deployment-safe by default: phone UI is hidden until `NEXT_PUBLIC_PHONE_AUTH_ENABLED=true`. The flag is only a presentation control; Supabase Phone Provider is the security and rollback control.

## 1. Database

Apply `supabase/migrations/012_phone_auth.sql` to the same Supabase project used by the site. The table is service-role-only and intentionally contains no OTP or plaintext phone field.

Migration `012` installs a 30-day cleanup function. Before public launch, schedule this statement daily using Supabase Cron or the project's existing database maintenance mechanism:

```sql
SELECT public.prune_sms_delivery_attempts();
```

## 2. Cloudflare Turnstile

1. Create a Turnstile widget for the production and preview domains.
2. Add its site key as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
3. Configure the corresponding secret in Supabase Auth CAPTCHA settings.
4. Keep phone auth disabled until the challenge works on the deployed login prompt.

The browser sends the Turnstile token directly to Supabase in `signInWithOtp`. The token is reset after every send attempt.

## 3. Alibaba Cloud SMS

Use a restricted RAM user that can call only the required SMS action. Configure an approved SMS signature and a verification-code template whose variable name matches `ALIYUN_SMS_TEMPLATE_PARAM` (default: `code`). Set the server-only environment variables listed in `.env.example`.

The hook signs the Alibaba Cloud RPC request itself and performs one `SendSms` call with a 2-second timeout. It does not retry because Alibaba Cloud `SendSms` is not idempotent. The database reservation also enforces at most five provider attempts per HMAC phone hash in ten minutes.

## 4. Send SMS Hook

Deploy the site, then set the Supabase Auth Send SMS Hook URL to:

```text
https://YOUR_DOMAIN/api/auth/hooks/send-sms
```

Copy the Supabase-generated hook signing secret into `SEND_SMS_HOOK_SECRETS`. The value shown by Supabase may begin with `v1,whsec_`; the route accepts that form. For secret rotation, use Supabase's `|` separator (semicolons and new lines are also accepted).

Before enabling Phone Provider, send signed fixtures that cover:

- valid `+86` request and Alibaba `Code=OK`;
- invalid signature;
- invalid phone and malformed payload;
- duplicate `webhook-id`;
- provider non-OK response;
- provider timeout/unknown result.

Never paste AccessKeys, OTPs, full phone numbers, or raw hook bodies into issue trackers or application logs.

## 5. Supabase Auth

Configure these controls before Phone Provider is enabled:

- CAPTCHA enabled with the Turnstile secret;
- SMS OTP expiry: 300 seconds;
- SMS resend interval: 60 seconds;
- appropriate `/otp` IP rate limits and project SMS quotas;
- Send SMS Hook enabled and pointing to the deployed route;
- Phone Provider enabled only after the hook test passes.

The hook is called by Supabase and does not receive the user's real IP. IP abuse protection therefore belongs in Supabase Auth and CAPTCHA, not in the hook.

## 6. Release Verification

With the public flag still disabled, verify through an internal deployment first:

1. New phone number creates a user and session.
2. Returning phone number signs into the same UID.
3. A signed-in Google user binds a phone using `phone_change` and keeps the same UID.
4. A phone already owned by another user is rejected and accounts are not merged.
5. After logout, signing in with the newly bound phone returns to the original Google UID.
6. Phone-only users see a masked number in the menu and settings.
7. Resend requires 60 seconds and a fresh CAPTCHA for signed-out login.

Then set `NEXT_PUBLIC_PHONE_AUTH_ENABLED=true` and redeploy.

## Rollback

1. Disable Supabase Phone Provider.
2. Set `NEXT_PUBLIC_PHONE_AUTH_ENABLED=false` and redeploy.
3. Keep the hook and audit table temporarily for investigation; rotate hook or Alibaba secrets if compromise is suspected.
