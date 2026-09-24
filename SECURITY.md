# Security and data protection

What w/hired does now, what to switch on in Supabase, and what to do next. This is engineering guidance, not legal advice: if you have users in regions with privacy laws (POPIA, GDPR and others), have someone qualified review your privacy policy and data handling.

## What people trust you with

Email and name, their target role and company, mock interview answers and scores, STAR stories, and research notes. Answers and notes can be personal. Treat all of it as sensitive.

## Already in place

**Users can only see their own data.** Every table has row-level security, so the database refuses cross-user reads and writes even if the app has a bug. Tables that hold secrets or operational data (`ai_providers`, `ai_provider_calls`, `admin_audit`, `admins`) have no client access at all.

**Quotas can't be bypassed from the app.** Users cannot insert research rows or subscriptions. Only Edge Functions can, and the monthly research check runs inside the database under a lock, so parallel requests can't overspend it.

**The app holds no secrets.** The only keys in the app are Supabase's publishable key and RevenueCat's public SDK keys, both designed to be public. The service-role key and AI keys exist only in Edge Functions.

**AI provider keys are encrypted.** Keys entered in the admin console are encrypted with AES-256-GCM before storage. The master key lives in an Edge Function secret, not the database, so a database leak alone exposes nothing. Each ciphertext is bound to its row, and keys are never returned to any client: the console shows the last four characters only.

**The admin console is locked down.**
- Server-side check on every action: valid login, listed in `admins`, and completed two-factor (authenticator code) this session.
- Admin membership can only be changed with SQL, never from the app.
- Every change is written to an audit log, without secrets.
- The admin function sends no CORS headers, so browsers can't call it cross-origin.
- Provider URLs must be public HTTPS hostnames. IP addresses, localhost and internal hosts are rejected, which blocks server-side request forgery through a mistyped or hijacked provider setting.
- Admins see usage counts for a user, never their answers, stories or notes.

**Sign-in.** Google and Microsoft use PKCE, so an intercepted redirect can't be exchanged for a session. Apple uses the native flow with a token Supabase verifies. Email sign-in requires confirmation.

**Cost abuse is capped.** Per-plan daily AI limits, monthly research credits, and provider limits with automatic failover mean one user or one provider can't run up an open-ended bill or take the app down.

**AI prompts treat user text as data.** Answers, notes and saved research are wrapped as material to evaluate, not instructions, and model output is validated and length-capped before it is stored or shown.

**Account deletion.** Deleting an account removes the profile, sessions, stories, research and usage rows by cascade.

## Switch these on in Supabase

- **Email confirmation** on, and a minimum password length of 8 or more.
- **Leaked-password protection** (checks passwords against known breaches) if your plan includes it.
- **CAPTCHA** on sign-up and sign-in (Turnstile or hCaptcha) to slow bots. The app needs a small change to pass the token; ask if you want it added.
- **Point-in-time recovery / backups** so a bad migration or accident is recoverable.
- **Separate projects for development and production**, so test data and test keys never mix with real users.
- **Network restrictions** on the database if you don't need direct connections.
- **Log alerts** on repeated failed logins and on Edge Function errors.

## Operational habits

- Keep `KEY_ENCRYPTION_SECRET` in a password manager. Anyone who can read Edge Function secrets and the database can decrypt provider keys, so limit who has Supabase dashboard access and use MFA on those accounts.
- Rotate a provider key by pasting a new one in the admin console. Revoke the old one at the provider.
- Keep the admin list short. Use a dedicated admin account.
- Never paste keys into chat, screenshots or the repo. `.env` is git-ignored; keep it that way.
- Schedule `purge_old_ai_calls()` (see the migration) so provider call logs don't grow forever.

## Recommended next steps

1. **Hardware-backed session storage.** The Supabase session is stored in AsyncStorage, which isn't encrypted. Supabase documents a pattern that keeps an encryption key in the device keychain (expo-secure-store) and the encrypted session in AsyncStorage. It touches the sign-in path, so test it on real devices. Worth doing before launch.
2. **Data export and history deletion** in the app, so users can download or delete their sessions, stories and research without deleting the account.
3. **Retention.** Decide how long mock transcripts are kept (for example 12 months) and delete older ones on a schedule. Keeping less is the best protection.
4. **Provider agreements.** Check each AI provider's terms on retention and training use of API data, choose the no-training and shortest-retention options, and list them in your privacy policy and store data forms.
5. **Row-level security tests.** Add automated tests that sign in as two users and confirm neither can read the other's rows.
6. **Free-tier email hygiene.** Consider blocking disposable email domains if you see farmed free accounts.
7. **Microsoft account linking.** Supabase can link sign-ins that share an email. That is safe when the provider verifies the email (Google and Apple do). Microsoft's email claim has been abused in multi-tenant setups ("nOAuth"), so read Supabase's Azure guidance and consider restricting tenants or turning off automatic linking.
8. **Column-level encryption** for the most sensitive free text (transcripts, notes), if your risk assessment calls for it. Supabase already encrypts data at rest and in transit; this protects against database-level access.
