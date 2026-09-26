# Legal Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an accurate trilingual Privacy Policy and Terms at `/privacy` and `/terms`, consent/disclaimer notices at sign-in, the mentor and event pages, and self-serve account deletion.

**Architecture:** Legal prose lives as typed data in `src/lib/legal/` (one file per document, `Record<Locale, LegalDoc>`), rendered by one client component that follows `LanguageContext`. Two thin server pages give the documents URLs + metadata. Deletion is a route handler that validates the session cookie and calls the Supabase admin API; FK cascades do the rest.

**Tech Stack:** Next.js 15 App Router, React 19, Supabase (`@supabase/ssr`, service role), Tailwind, vitest.

## Global Constraints

- Operator string (verbatim): `Umidjon Norkuziev`
- Contact email (verbatim): `norqoziyevumidjon690@gmail.com`
- Governing law: Republic of Uzbekistan. English version prevails.
- Minimum age 13; under-18s need a parent's/guardian's permission.
- Every new UI string exists in `en`, `uz`, `ru` (tests/translations.test.mjs enforces key parity).
- No new dependencies. No DB migration.

---

### Task 1: Legal content module + parity test

**Files:**
- Create: `src/lib/legal/types.ts`
- Create: `src/lib/legal/privacy.ts`
- Create: `src/lib/legal/terms.ts`
- Test: `tests/legal-docs.test.ts`

**Interfaces:**
- Produces: `LegalDoc`, `LegalDocs`, `LEGAL_OPERATOR`, `LEGAL_EMAIL`, `privacyDocs: LegalDocs`, `termsDocs: LegalDocs`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/legal-docs.test.ts
import { describe, it, expect } from 'vitest';
import { privacyDocs } from '../src/lib/legal/privacy';
import { termsDocs } from '../src/lib/legal/terms';
import { LEGAL_EMAIL, LEGAL_OPERATOR } from '../src/lib/legal/types';

const LOCALES = ['en', 'uz', 'ru'] as const;

describe.each([
  ['privacy', privacyDocs],
  ['terms', termsDocs],
])('%s docs', (_name, docs) => {
  it('exist for en, uz, ru', () => {
    expect(Object.keys(docs).sort()).toEqual(['en', 'ru', 'uz']);
  });

  it('have the same section ids in every locale', () => {
    const base = docs.en.sections.map((s) => s.id);
    for (const loc of LOCALES) {
      expect(docs[loc].sections.map((s) => s.id), loc).toEqual(base);
    }
  });

  it('name the operator and contact email in every locale', () => {
    for (const loc of LOCALES) {
      const text = docs[loc].sections.flatMap((s) => s.body).join('\n');
      expect(text, `${loc} operator`).toContain(LEGAL_OPERATOR);
      expect(text, `${loc} email`).toContain(LEGAL_EMAIL);
    }
  });

  it('has no empty headings or paragraphs', () => {
    for (const loc of LOCALES) {
      for (const s of docs[loc].sections) {
        expect(s.heading.trim().length, `${loc}/${s.id} heading`).toBeGreaterThan(0);
        expect(s.body.length, `${loc}/${s.id} body`).toBeGreaterThan(0);
        for (const p of s.body) expect(p.trim().length, `${loc}/${s.id}`).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 2: Run it — expect FAIL (modules missing)**

Run: `npx vitest run tests/legal-docs.test.ts`
Expected: FAIL — "Failed to resolve import ../src/lib/legal/privacy".

- [ ] **Step 3: Create the types module**

```ts
// src/lib/legal/types.ts
import type { Locale } from '@/lib/translations';

export const LEGAL_OPERATOR = 'Umidjon Norkuziev';
export const LEGAL_EMAIL = 'norqoziyevumidjon690@gmail.com';
export const LEGAL_UPDATED = '2026-09-16';

export interface LegalSection {
  /** Stable anchor id — identical across locales (e.g. "cookies"). */
  id: string;
  heading: string;
  /** Paragraphs. A paragraph starting with "• " renders as a bullet. */
  body: string[];
}

export interface LegalDoc {
  title: string;
  /** Short intro paragraph under the title. */
  intro: string;
  sections: LegalSection[];
}

export type LegalDocs = Record<Locale, LegalDoc>;
```

- [ ] **Step 4: Author `privacy.ts`** — `export const privacyDocs: LegalDocs` with these section ids in this order, in all three locales: `who`, `collect`, `cookies`, `processors`, `retention`, `rights`, `children`, `changes`. Content per spec §2. `who` and `changes` must include `LEGAL_OPERATOR` / `LEGAL_EMAIL` via template strings.

- [ ] **Step 5: Author `terms.ts`** — `export const termsDocs: LegalDocs` with ids: `who`, `service`, `accuracy`, `ai`, `links`, `accounts`, `use`, `ip`, `removal`, `liability`, `changes`, `law`, `contact`. Content per spec §3.

- [ ] **Step 6: Run the test — expect PASS**

Run: `npx vitest run tests/legal-docs.test.ts`
Expected: 8 passed.

---

### Task 2: LegalPage component + `/privacy` + `/terms` routes + sitemap

**Files:**
- Create: `src/components/legal/LegalPage.tsx`
- Create: `src/app/privacy/page.tsx`
- Create: `src/app/terms/page.tsx`
- Modify: `src/app/sitemap.ts`

**Interfaces:**
- Consumes: `LegalDocs` from Task 1.
- Produces: `<LegalPage docs={LegalDocs} />`.

- [ ] **Step 1: Component**

```tsx
// src/components/legal/LegalPage.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { SiteNav } from '@/components/home/SiteNav';
import { SiteFooter } from '@/components/home/SiteFooter';
import { LEGAL_UPDATED, type LegalDocs } from '@/lib/legal/types';

/**
 * Renders one legal document in the visitor's current locale. English is the
 * SSR default (LanguageProvider starts on 'en'), which is also the legally
 * binding text — the Terms say so.
 */
export function LegalPage({ docs }: { docs: LegalDocs }) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const doc = docs[locale];

  return (
    <>
      <SiteNav />
      <main className="container max-w-3xl py-28 md:py-32">
        <p className="text-eyebrow mb-3 text-muted-foreground">
          {t.legalUpdated} {LEGAL_UPDATED}
        </p>
        <h1 className="mb-4 font-display text-4xl font-semibold tracking-tight md:text-5xl">{doc.title}</h1>
        <p className="mb-12 text-base leading-relaxed text-muted-foreground">{doc.intro}</p>

        {doc.sections.map((s) => (
          <section key={s.id} id={s.id} className="mb-10 scroll-mt-28">
            <h2 className="mb-3 font-display text-xl font-semibold">{s.heading}</h2>
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              {s.body.map((p, i) =>
                p.startsWith('• ') ? (
                  <p key={i} className="pl-4">{p}</p>
                ) : (
                  <p key={i}>{p}</p>
                ),
              )}
            </div>
          </section>
        ))}
      </main>
      <SiteFooter t={t} onCategory={() => router.push('/')} />
    </>
  );
}
```

- [ ] **Step 2: Routes**

```tsx
// src/app/privacy/page.tsx
import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { privacyDocs } from '@/lib/legal/privacy';

export const metadata: Metadata = {
  title: 'Privacy Policy — Fursatly',
  description: 'What Fursatly collects, why, who processes it, and your rights.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return <LegalPage docs={privacyDocs} />;
}
```

```tsx
// src/app/terms/page.tsx
import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { termsDocs } from '@/lib/legal/terms';

export const metadata: Metadata = {
  title: 'Terms of Use — Fursatly',
  description: 'The rules for using Fursatly, what we do and do not guarantee, and how to request content removal.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return <LegalPage docs={termsDocs} />;
}
```

- [ ] **Step 3: Sitemap** — in `src/app/sitemap.ts`, after `const home = ...`, add:

```ts
  const legal = ['/privacy', '/terms'].map((p) => ({
    url: `${BASE}${p}`,
    changeFrequency: 'yearly' as const,
    priority: 0.3,
  }));
```
and return `[home, ...legal, ...events]` (and `[home, ...legal]` in the catch).

- [ ] **Step 4: Translation key** — add `legalUpdated` to all three locales in `src/lib/translations.ts` (en `'Last updated'`, uz `'Oxirgi yangilanish'`, ru `'Последнее обновление'`).

- [ ] **Step 5: Typecheck + tests**

Run: `npm run typecheck && npx vitest run`
Expected: clean; all tests pass.

---

### Task 3: Footer links replace the legal modals

**Files:**
- Modify: `src/components/home/SiteFooter.tsx`

- [ ] **Step 1:** Change `type LegalKey = 'about'`; delete the `privacy`, `terms`, `cookies` entries from `LEGAL_CONTENT`.
- [ ] **Step 2:** Replace the Legal `<ul>` items with:

```tsx
<li><Link href="/privacy" className="text-muted-foreground transition-colors hover:text-accent">{t.footerPrivacy}</Link></li>
<li><Link href="/terms" className="text-muted-foreground transition-colors hover:text-accent">{t.footerTerms}</Link></li>
<li><Link href="/privacy#cookies" className="text-muted-foreground transition-colors hover:text-accent">{t.footerCookies}</Link></li>
<li><button onClick={() => setLegal('about')} className="text-muted-foreground transition-colors hover:text-accent">{t.footerAbout}</button></li>
```
Add `import Link from 'next/link';`.

- [ ] **Step 3:** `npm run typecheck` — clean.

---

### Task 4: In-app notices (auth consent, mentor disclaimer, event notice)

**Files:**
- Modify: `src/lib/translations.ts` (keys: `authConsentPrefix`, `authConsentTerms`, `authConsentAnd`, `authConsentPrivacy`, `mentorDisclaimer`, `eventSourceNotice`, `eventReportLink`)
- Modify: `src/app/auth/page.tsx` (after the `<div className="space-y-3">…</div>` block, before `</div>` of the card)
- Modify: `src/components/mentor/MentorPanel.tsx` (inside the composer `<form>` wrapper — add a line under the form)
- Modify: `src/app/event/[id]/EventClient.tsx` (after the `{applyHref && (...)}` block)

- [ ] **Step 1: Keys** (en / uz / ru):

```
authConsentPrefix: 'By continuing you agree to the' / 'Davom etish orqali siz' / 'Продолжая, вы принимаете'
authConsentTerms:  'Terms of Use' / 'Foydalanish shartlari' / 'Условия использования'
authConsentAnd:    'and' / 'va' / 'и'
authConsentPrivacy:'Privacy Policy.' / 'Maxfiylik siyosatiga rozilik bildirasiz.' / 'Политику конфиденциальности.'
mentorDisclaimer:  'AI can make mistakes. Confirm deadlines and requirements on the official page.' / 'AI xato qilishi mumkin. Muddat va talablarni rasmiy sahifada tekshiring.' / 'ИИ может ошибаться. Проверяйте сроки и требования на официальной странице.'
eventSourceNotice: 'Summarised from a public announcement; details may change. Confirm with the organiser before applying.' / 'Ochiq e’londan qisqacha tayyorlangan; tafsilotlar o‘zgarishi mumkin. Topshirishdan oldin tashkilotchi bilan tekshiring.' / 'Составлено по открытому объявлению; детали могут измениться. Уточните у организатора перед подачей.'
eventReportLink:   'Report a problem or request removal' / 'Muammo haqida xabar berish yoki olib tashlashni so‘rash' / 'Сообщить о проблеме или запросить удаление'
```

- [ ] **Step 2: Auth consent line**

```tsx
<p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
  {t.authConsentPrefix}{' '}
  <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">{t.authConsentTerms}</Link>{' '}
  {t.authConsentAnd}{' '}
  <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">{t.authConsentPrivacy}</Link>
</p>
```

- [ ] **Step 3: Mentor disclaimer** — wrap the composer: keep the `<form>` unchanged and add directly after `</form>`:

```tsx
<p className="border-t border-border px-4 py-2 text-center text-[11px] leading-snug text-muted-foreground">
  {t.mentorDisclaimer}
</p>
```

- [ ] **Step 4: Event notice** — after the `{applyHref && (...)}` block inside the aside:

```tsx
<p className="mt-4 text-xs leading-relaxed text-muted-foreground">
  {t.eventSourceNotice}{' '}
  <a
    href={`mailto:${LEGAL_EMAIL}?subject=${encodeURIComponent(`Fursatly: ${event.title}`)}`}
    className="underline underline-offset-2 hover:text-foreground"
  >
    {t.eventReportLink}
  </a>
</p>
```
Import `LEGAL_EMAIL` from `@/lib/legal/types`.

- [ ] **Step 5:** `npm run typecheck && npx vitest run` — clean.

---

### Task 5: Account deletion

**Files:**
- Create: `src/app/api/account/delete/route.ts`
- Modify: `src/app/account/AccountClient.tsx`
- Modify: `src/lib/translations.ts` (keys: `deleteAccount`, `deleteAccountTitle`, `deleteAccountBody`, `deleteAccountConfirm`, `deleteAccountDone`, `cancel`)

- [ ] **Step 1: Route**

```ts
// src/app/api/account/delete/route.ts
/**
 * POST /api/account/delete — permanently deletes the caller's account.
 *
 * Validates the session cookie, then removes the auth user with the service
 * role. FK cascades take profiles → saved_opportunities → reminders_sent and
 * mentor_usage with it, so no per-table cleanup is needed here.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('[Account] delete failed:', error.message);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Keys** (en / uz / ru):

```
deleteAccount:        'Delete account' / 'Hisobni o‘chirish' / 'Удалить аккаунт'
deleteAccountTitle:   'Delete your account?' / 'Hisobingiz o‘chirilsinmi?' / 'Удалить аккаунт?'
deleteAccountBody:    'This permanently removes your profile, saved opportunities and reminder settings. It cannot be undone.' / 'Bu profilingiz, saqlangan imkoniyatlar va eslatma sozlamalarini butunlay o‘chiradi. Qaytarib bo‘lmaydi.' / 'Это навсегда удалит ваш профиль, сохранённые возможности и настройки напоминаний. Отменить нельзя.'
deleteAccountConfirm: 'Yes, delete everything' / 'Ha, hammasini o‘chirish' / 'Да, удалить всё'
deleteAccountDone:    'Your account has been deleted.' / 'Hisobingiz o‘chirildi.' / 'Ваш аккаунт удалён.'
cancel:               'Cancel' / 'Bekor qilish' / 'Отмена'
```

- [ ] **Step 3: Client** — in `AccountClient.tsx`: import `Trash2` from lucide and `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter` from `@/components/ui/dialog`; add state `const [confirmDelete, setConfirmDelete] = useState(false); const [deleting, setDeleting] = useState(false);` and handler:

```tsx
const handleDelete = async () => {
  setDeleting(true);
  const res = await fetch('/api/account/delete', { method: 'POST' });
  if (!res.ok) {
    setDeleting(false);
    toast({ title: t.authErrorGeneric, variant: 'destructive' });
    return;
  }
  await signOut();
  toast({ title: t.deleteAccountDone });
  router.replace('/');
};
```

Below the Telegram/reminders card (before the saved column closes), add a "danger" card:

```tsx
<div className="rounded-2xl border border-destructive/30 bg-card p-6 md:p-8">
  <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
    <Trash2 className="mr-2 h-4 w-4" />
    {t.deleteAccount}
  </Button>
</div>

<Dialog open={confirmDelete} onOpenChange={(o) => !deleting && setConfirmDelete(o)}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle className="font-display text-2xl">{t.deleteAccountTitle}</DialogTitle>
      <DialogDescription>{t.deleteAccountBody}</DialogDescription>
    </DialogHeader>
    <DialogFooter className="gap-2 sm:gap-0">
      <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>{t.cancel}</Button>
      <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
        {t.deleteAccountConfirm}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 4: Age floor** — in the same file change `min={10}` to `min={13}` on `#pf-age`.

- [ ] **Step 5:** `npm run typecheck && npx vitest run` — clean.

---

### Task 6: Verify in the browser

- [ ] Start the dev server (`.claude/launch.json` → port 9002).
- [ ] `/privacy` and `/terms` render in EN; switch language → UZ/RU; `/privacy#cookies` scrolls to the section.
- [ ] Footer links navigate; About modal still opens.
- [ ] `/auth` shows the consent line with working links.
- [ ] An event page shows the notice under the apply button; the mentor panel shows the disclaimer.
- [ ] `/sitemap.xml` lists `/privacy` and `/terms`.
- [ ] `curl -X POST localhost:9002/api/account/delete` → 401 (no cookie).
- [ ] `npm run build` succeeds.
