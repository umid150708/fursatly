# Legal compliance — Privacy Policy, Terms, notices, account deletion

Date: 2026-09-16
Status: approved

## Goal

Give fursatly.uz the legal surfaces a public site with accounts, Telegram
DMs and an AI chatbot needs: an accurate trilingual Privacy Policy and Terms
at real URLs, consent and disclaimer notices where users act, and self-serve
account deletion. Not legal advice; reduces exposure, does not eliminate it.

## Facts fixed by the operator

- Operator: **Umidjon Norkuziev**, an individual based in Uzbekistan.
- Contact for privacy / legal / removal requests: **norqoziyevumidjon690@gmail.com**.
- Governing law: Republic of Uzbekistan.
- Minimum age: 13; under-18s need a parent's or guardian's permission.
- English text prevails if a translation conflicts with it.

## What exists today (and is replaced)

`src/components/home/SiteFooter.tsx` holds English-only Privacy / Terms /
Cookies / About text in a modal, dated May 2025. Claims in it are wrong
(usage-data collection for recommendations, "EU region") and it omits Google
sign-in, Telegram linking, profile fields, saved lists, reminder DMs, and the
mentor chat being sent to Groq / Google. It is not reachable at a URL.

## Design

### 1. Legal pages

- `src/lib/legal/types.ts` — `LegalDoc = { title, intro, sections: { id, heading, body: string[] }[] }`, `LEGAL_UPDATED` constant,
  `LegalDocs = Record<Locale, LegalDoc>`.
- `src/lib/legal/privacy.ts`, `src/lib/legal/terms.ts` — trilingual content.
  A vitest (`tests/legal-docs.test.ts`) asserts every locale has the same
  number of sections and that the operator name + contact email appear in each.
- `src/components/legal/LegalPage.tsx` — client component: SiteNav, the
  document for the current `LanguageContext` locale, SiteFooter. Section
  `id`s become anchors (`/privacy#cookies`).
- `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` — server components
  exporting metadata (title, description, canonical) and rendering LegalPage.
- `src/app/sitemap.ts` — adds both URLs.
- Footer: Privacy → `/privacy`, Terms → `/terms`, Cookies → `/privacy#cookies`
  as `<Link>`s. The About modal stays; its legal siblings are removed from the
  modal content map.

### 2. Privacy Policy content (sections)

1. Who we are (operator, contact).
2. What we collect and why — account identity (email; Google name + avatar;
   Telegram ID + username), optional profile (age, country, interests), saved
   opportunities, Telegram chat ID for reminders (opt-out toggle), mentor chat
   messages (sent to Groq and Google to produce a reply; not stored by us;
   a daily usage counter is kept), language/theme in localStorage,
   cookieless analytics (Vercel).
3. Cookies (`id: cookies`) — only the strictly necessary Supabase session
   cookie; no advertising or tracking cookies; no banner needed.
4. Who processes data — Supabase, Vercel, Groq, Google (OAuth + Gemini),
   Telegram; servers may be outside Uzbekistan.
5. How long we keep it — until the account is deleted; expired events are
   deleted automatically.
6. Your rights — access, correction, deletion (self-serve button on the
   account page, or email), withdraw reminder consent.
7. Children — 13+, parental permission under 18.
8. Changes and contact.

### 3. Terms content (sections)

1. Who we are / acceptance.
2. The service — free aggregator of publicly announced opportunities,
   summarised and translated by AI.
3. No guarantee of accuracy; not affiliated with any organiser; confirm with
   the official source before applying.
4. AI-generated content (summaries, translations, mentor chat) may be wrong.
5. External links.
6. Accounts — 13+, under-18 parental permission, keep credentials safe.
7. Acceptable use — no scraping, abuse, impersonation, disruption.
8. Intellectual property — Fursatly name/design ours; opportunity content
   belongs to its organisers.
9. Content removal requests — organisers and channel owners email the contact;
   acted on within 7 days.
10. Limitation of liability — provided "as is"; no liability for application
    outcomes or third-party sites, to the extent permitted by law.
11. Changes to the terms.
12. Governing law — Uzbekistan; English version prevails.
13. Contact.

### 4. In-app notices (keys added to `src/lib/translations.ts`, all locales)

- `/auth` page, under the sign-in options: "By continuing you agree to the
  Terms and Privacy Policy" with links.
- Mentor panel: "AI can make mistakes. Confirm deadlines and requirements on
  the official page."
- Event page, near the apply link: "Summarised from a public announcement;
  details may change. Confirm with the organiser before applying." plus a
  "Report a problem / request removal" mailto link.

### 5. Account deletion

- `POST /api/account/delete` — `createServerSupabase().auth.getUser()`; 401
  without a session; service-role `auth.admin.deleteUser(user.id)`; 200 `{ok:true}`.
  Existing FK cascades remove `profiles` → `saved_opportunities` →
  `reminders_sent`, and `mentor_usage`. No migration.
- Account page: "Delete account" (destructive) → confirm dialog → POST →
  `signOut()` → `router.replace('/')` → toast.

### 6. Age floor

- Account page age input `min` 10 → 13 (DB check constraint untouched).

## Out of scope

- Google Cloud OAuth consent screen: paste `https://fursatly.uz/privacy`
  and `/terms` (dashboard step).
- Uzbekistan personal-data localisation (Art. 27-1): needs a lawyer, not code.
- A cookie banner: not required (no non-essential cookies).
