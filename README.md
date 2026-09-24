# w/hired

Interview prep for anyone going after a dream role. Expo + React Native (SDK 57), React Navigation, Supabase. One codebase for iOS and Android.

## What's in the app

| Tab | What it does |
| --- | --- |
| Home | Dot-matrix dashboard: countdown, last score, streak, skills, focus area, stories, score trend, question of the day, plan and research credits |
| Research | Look up an organisation once. It's saved and reused in every mock interview. Refresh only when you choose. Add your own notes for free |
| Mock | AI mock interview tailored to role, company and your saved research. Unlimited, with a fair-use daily ceiling |
| Stories | STAR story bank |
| You | Target, history, plan, sign out, delete account, and the Admin console (admins only) |

**Plans.** Free: 10 organisation researches a month, unlimited mock interviews (fair use). Pro: limits set in the admin console. Every number is editable there.

**What counts as a research credit.** A new organisation lookup, or a refresh of one. Opening saved research, editing notes, and running mock interviews never use a credit. Credits reset on the 1st of each month (UTC). A failed lookup is not charged.

**Sign-in.** Email and password, Google, Microsoft, and Apple (iOS only).

## Project layout

```
App.js, navigation/        auth-gated stack, tab shell (5 tabs stay mounted), tab bar
screens/                   Auth, Onboarding, Home, Research, Mock, Stories, StoryEdit, Profile, Upgrade
screens/admin/             Admin console: gate (MFA), overview, providers, plans, users, audit
components/dot/            dot-matrix DotText, DotRing, DotBars, DotMeter, DotLine
lib/                       theme, supabase client, auth + plan context, oauth, billing, org, admin API
supabase/migrations/       001 base schema, 002 plans / research / AI providers / admin
supabase/functions/        interview, research, admin, revenuecat-webhook, delete-account
supabase/functions/_shared AI router with failover, key encryption, capacity maths, tests
SECURITY.md                what protects user data, what to switch on, what to do next
```

## 1. Supabase setup (new project)

1. Create a new project at supabase.com.
2. SQL Editor: run `supabase/migrations/20260924000001_init.sql`, then `20260924000002_plans_research_admin.sql`. (Already ran the earlier `schema.sql`? Skip the first file and run only the second.)
3. Sign up in the app once with the account you'll use as admin, then make it an admin (SQL Editor):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'awandembeje@gmail.com';
   ```
4. Authentication settings:
   - URL Configuration > Redirect URLs: add `whired://**` (and `exp://**` while testing in Expo Go).
   - Keep email confirmation on.
   - Multi-factor: make sure TOTP (authenticator app) is enabled. The admin console requires it.
5. Project Settings > API: copy the URL and publishable key into `.env` (see step 4).

## 2. Deploy the functions

```bash
npm i -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF

# Master key that encrypts provider API keys. Keep a copy in your password manager:
# if it is lost, the saved provider keys must be entered again.
supabase secrets set KEY_ENCRYPTION_SECRET=$(openssl rand -base64 32)

supabase functions deploy interview research admin delete-account
supabase functions deploy revenuecat-webhook --no-verify-jwt
```

If the gateway rejects signed-in requests to `interview`, `research`, `admin` or `delete-account` with a 401, redeploy those with `--no-verify-jwt` too. Each function verifies the caller itself.

**AI keys no longer live in secrets or code.** After deploying, sign in as admin, open You > Admin console, finish the two-factor setup, and add your first provider under AI providers. Until one is added, mock interviews and research report "busy".

## 3. Sign-in providers

Dashboard labels may have shifted since this was written; Supabase's guides for each provider have the current steps.

- **Google.** In Google Cloud Console create an OAuth client (type: Web application). Add `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback` as an authorised redirect URI. Paste the client ID and secret into Authentication > Providers > Google.
- **Microsoft.** In Microsoft Entra, register an app. Choose supported account types to include personal Microsoft accounts if you want them. Add the same Supabase callback URL as a redirect (Web). Create a client secret (it expires, so set a reminder). Paste the application ID, secret and tenant URL into Authentication > Providers > Azure, following Supabase's Azure guide.
- **Apple.** Enable Sign in with Apple for your App ID in the Apple Developer portal. In Authentication > Providers > Apple, add your bundle ID (`com.whired.app`, or the one you chose) under authorised client IDs. The app uses Apple's native sheet on iOS, so no client secret is needed. The web flow's secret has to be regenerated every six months, and this avoids that. The Apple button is not shown on Android.

Apple's App Store rules require an equivalent privacy-preserving login when you offer third-party sign-in. Sign in with Apple satisfies that, so keep it on iOS.

## 4. Run it

```bash
cp .env.example .env        # Supabase URL + publishable key
npm install
npx expo install --fix      # aligns any version drift with SDK 57
npx expo start
```

Email sign-in and everything except purchases works in Expo Go. Google and Microsoft sign-in, Apple sign-in, and purchases are best tested in a development build (`eas build --profile development`).

## 5. Subscriptions (RevenueCat)

Apple and Google require in-app purchase for digital subscriptions, so payments go through the stores. RevenueCat wraps both.

1. Create a subscription product in App Store Connect and in Play Console.
2. In RevenueCat: add both apps, create an entitlement named `pro`, attach the products, and add them to the current offering.
3. In the project:
   ```bash
   npx expo install react-native-purchases expo-dev-client
   ```
   Put RevenueCat's public SDK keys in `.env` (`EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`). Purchases need a development build; Expo Go only previews.
4. Webhook: RevenueCat > Integrations > Webhooks. URL is your `revenuecat-webhook` function URL. Set the Authorization header to `Bearer <secret>` and store the same secret:
   ```bash
   supabase secrets set REVENUECAT_WEBHOOK_SECRET=<long random string>
   ```
5. Test with sandbox accounts before you submit.

The app never tells the server what a user bought. RevenueCat tells the webhook, the webhook updates `subscriptions`, and the database decides each user's plan. The app just re-reads it after a purchase. Until `react-native-purchases` is installed and keys are set, the Upgrade screen says purchases aren't set up.

Set the Pro price in App Store Connect and Play Console. The "price label" in the admin console is display text only.

## 6. The admin console

You > Admin console (visible only to admins; the server enforces it, not just the screen). It asks for an authenticator-app code each session.

- **Overview.** AI headroom today, users, paid users, calls, research runs, provider health, and warnings (no failover, provider near its limit, cooling down after errors, low headroom, plans with no daily cap). It refreshes every 30 seconds.
- **AI providers.** Add, edit, disable, delete and test providers. Enter keys here, never in code. Each provider has a priority, purposes (interviews, research), and optional limits for requests per minute, per day and tokens per day. The card shows current usage against those limits, plus the rate-limit headers the provider itself reports. Anthropic providers can use web search for sourced research.
- **Plans.** Change research credits and daily AI calls per plan (blank = unlimited), and the plan text.
- **Users.** Look up a user by email to see plan and usage counts, and grant or revoke manual Pro access. You never see their answers, stories or notes.
- **Audit.** Every change is recorded. Keys are never written to the log.

How requests are routed: lowest priority number first. A provider is skipped while it is disabled, without a key, cooling down, or over a limit you set. On a rate limit, auth error, outage, timeout or unusable answer, the request moves to the next provider and the failing one rests (rate limits use the provider's Retry-After). Set your limits a little under what each provider's own plan allows so traffic moves before the provider starts refusing.

## 7. Tests

The routing, failover, encryption, URL guard, capacity maths and billing mapping have tests that run on Node 22.18+ (or Deno):

```bash
node --test supabase/functions/_shared/*.test.ts
```

## 8. Before you build for the stores

- Change `com.whired.app` in `app.json` (`ios.bundleIdentifier`, `android.package`) to an identifier you own. It can't change after release.
- Fill in `lib/config.js` (privacy policy URL, terms URL, support email). Both stores require a privacy policy, and Apple requires it and terms links near subscriptions.
- If `w/hired` as the display name causes trouble in prebuild or store upload, set `name` to `whired` in `app.json`.
- Confirm the name is free on both stores.

## 9. Publish with EAS

```bash
npm i -g eas-cli
eas login
eas build:configure
```

`.env` is git-ignored, so add `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` and the two RevenueCat keys as environment variables on your Expo project (expo.dev > your project > Environment variables, or `eas env:create`).

```bash
eas build --profile preview --platform android    # installable APK for testers
eas build --profile production --platform all     # store builds
eas submit --platform ios
eas submit --platform android
```

The first upload of a new Android app usually has to be done by hand in Play Console; `eas submit` works after that.

### Store checklist

- **Account deletion** is built in (You > Delete account). Apple requires it.
- **Privacy labels / Data safety form.** Declare email, name, and user content (mock answers, stories, research notes). State that this content is sent to third-party AI providers you choose in the admin console to generate feedback and research, and list who they are.
- **AI content.** The Mock and Research screens tell users output is AI-generated and can be wrong. Keep that.
- **Subscriptions.** Include auto-renewal wording, price and period, Restore purchases, and terms and privacy links. The Upgrade screen has these; review the wording.
- **Google Play, new personal accounts.** A closed test with at least 12 testers for 14 continuous days is required before production access. Organisation accounts are exempt. Check Play Console Help for the current rule.

## What's verified and what isn't

Verified here: the app bundles for iOS and Android; 25 backend tests pass (router failover, key encryption, URL guard, capacity and warnings, billing mapping); the client and server organisation-key functions agree; all Edge Functions parse and the shared modules type-check.

Not verified: the SQL migrations have not been run against a live Postgres; the Edge Functions haven't been deployed; the Google, Microsoft and Apple sign-in flows, the RevenueCat purchase flow, Anthropic web-search responses and the MFA screens haven't been exercised end to end; nothing has been run on a device. Expect to fix small things on the first pass through each.

## Known gaps

- Password reset still sends Supabase's default email. Finishing the reset in the app needs a `whired://` deep-link handler.
- No voice answers, reminders or CV builder yet.
- Sessions are stored in AsyncStorage. See SECURITY.md for the upgrade to hardware-backed storage.
- Dark theme only.
