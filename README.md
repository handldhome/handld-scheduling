# Handld Technician Scheduling System

Web-based availability form for technicians to submit their weekly availability.

## Setup

1. Install dependencies:
```bash
   npm install
```

2. Copy environment variables:
```bash
   cp .env.local.example .env.local
```

3. Fill in `.env.local` (see the comments in `.env.local.example`): Supabase
   service-role key, Twilio credentials, `ADMIN_SECRET_KEY`, `CRON_SECRET`,
   `OWNER_ALERT_PHONE`.

4. Run development server:
```bash
   npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Usage

Technicians access their availability form at:
```
http://localhost:3000/tech/[TECH_ID]/availability
```

Where `[TECH_ID]` is the technician's UUID (legacy Airtable record IDs still resolve).

## Texting (SMS compliance)

Every outbound text goes through `lib/sms.js` → `sendSms()`. Do not call the
Twilio client from a route directly. `sendSms` enforces the shared Handld rules
(spec version `2026-11-25`, shared with the web and handld-pro apps):

- **Opt-outs.** `handld.sms_opt_outs` is checked before every send
  (`status: 'skipped_opt_out'`). A Twilio 21610 error (recipient replied STOP)
  writes the number onto that list.
- **Identification + footer.** Customer texts name Handld and say
  `Questions? Call (626) 298-7128 or reply to this text.` ((626) 298-7128 is
  voice-only; never write "Text us at"). Technician texts start with
  `Handld: ` (`withHandldPrefix`). Both end with ` Reply STOP to opt out.`
  (`withStopFooter`). Owner alerts (`recipientType: 'owner'`, to
  `OWNER_ALERT_PHONE`) are exempt.
- **Texting hours.** Customer texts that are not an immediate reply to the
  customer's own action are only sent 08:00–20:59 America/Los_Angeles.
  Outside that window the route returns HTTP 422
  `{ error: 'outside_texting_hours', nextWindow }` and the admin UI says
  "Texting hours are 8am–9pm Pacific. Try again after …". `public/book`
  (the customer just booked) passes `exemptFromQuietHours: true`. Technician
  texts have no window, but the cron GETs (`send-schedule-reminder`,
  `send-availability-reminder`) return `{ skipped: 'quiet_hours' }` between
  21:00 and 07:59 PT.
- **Technician consent.** The onboarding form has a required SMS consent
  checkbox; `POST /api/technicians/onboard` refuses a phone without
  `smsConsent: true`, sets `technicians.sms_consent_at` and writes a
  `handld.sms_consents` row (source `tech_onboarding`). Every technician send
  skips techs with no `sms_consent_at` and reports them as
  `skippedNoConsent: [{ id, name }]`. The Texts tab lists them ("Needs
  consent") with **Send consent request** (`POST /api/send-consent-request`,
  the one send allowed before consent; a YES reply is recorded by the Twilio
  webhook in handld-pro) and **Record consent** (`PATCH
  /api/technicians/[techId]` with `{ smsConsent: true, consentSource }`,
  source `admin_manual`).
- **Numbers not in the database** (`send-tech-text` → `newTechs`) only ever
  receive the fixed onboarding invite, once per number per 24 hours.
- **Logging.** Every attempt (sent / failed / skipped) is written to
  `handld.sms_log`; if that insert fails the API response carries the reason
  as `logError`.

Tests: `npm test` (vitest). `tests/sms.test.mjs` covers `lib/sms.js`.

## Deployment

Deploy to Vercel:
```bash
vercel
```

Set up custom domain: schedule.handldhome.com
