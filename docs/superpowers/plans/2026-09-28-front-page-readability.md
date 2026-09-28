# Front-page readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Gazette easier to read: a calmer night edition, one-column body text, newspaper labels, and a motto tied to no place.

**Architecture:** Pure presentation changes. Colour lives in CSS custom properties in `src/app/globals.css` (`.dark {}` for the night edition); copy lives in `src/lib/translations.ts` (EN/UZ/RU) plus three metadata files. Each design intent is pinned by a vitest test that reads the real CSS or copy, so a later edit cannot silently undo it.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS, vitest 4.

**Specs:** `docs/superpowers/specs/2026-09-28-night-edition-retune-design.md`, `docs/superpowers/specs/2026-09-28-editorial-voice-and-measure-design.md`

## Global Constraints

- Branch: `front-page-readability` (already checked out). Do not push.
- Light edition (`:root`) colours must not change.
- Every translation change is made in all three locales: `en`, `uz`, `ru`. `tests/translations.test.mjs` enforces key parity — values change, keys do not.
- UZ strings use `\'` for the apostrophe inside single-quoted TS strings, matching the file.
- No `!important`. No new dependencies.
- Commit messages: sentence-case summary in the repo's style (no `feat:` prefixes), ending with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run commands from `/Users/user/Desktop/Coding projects/Fursatly`.

---

### Task 1: Night edition retune

**Files:**
- Modify: `src/app/globals.css:62,64,66,67,70,78,83-88,90,197`
- Test: `tests/category-taxonomy.test.mjs` (append a describe block)

**Interfaces:**
- Consumes: `varsIn(blockRe)`, `contrast(a, b)` and `css` already defined in `tests/category-taxonomy.test.mjs`.
- Produces: nothing later tasks use.

- [ ] **Step 1: Write the failing tests** — append to the end of `tests/category-taxonomy.test.mjs`:

```js
// ── Night edition: calm by measurement, not by eye ──────────────────────────
// Measured on the live site (2026-09-28): hairlines at 1.61:1 grouped nothing,
// near-white display type glared at 14.6:1, nine category hues at up to 85%
// saturation read as a rainbow, and screen-blended grain shimmered.
describe('night edition (dark) stays calm', () => {
  const dark = varsIn(/\.dark\s*{[^}]+}/);
  const bg = dark.background;

  it('hairlines (--border) reach 3:1 against the page — WCAG 1.4.11', () => {
    const ratio = contrast(dark.border, bg);
    expect(ratio, `--border ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
  });

  it('display ink (--foreground) stays at or below 12:1 so large type does not glare', () => {
    const ratio = contrast(dark.foreground, bg);
    expect(ratio, `--foreground ${ratio.toFixed(2)}:1`).toBeLessThanOrEqual(12);
  });

  it('category hues are calm: saturation at most 40%', () => {
    for (const [name, [, s]] of Object.entries(dark)) {
      if (!name.startsWith('cat-')) continue;
      expect(s, `--${name} saturation`).toBeLessThanOrEqual(40);
    }
  });

  it('paper grain is faint: opacity at most 0.04', () => {
    const m = css.match(/\.dark\s+\.paper-grain\s*{[^}]*opacity:\s*([\d.]+)/);
    expect(m, '.dark .paper-grain rule').toBeTruthy();
    expect(Number(m[1])).toBeLessThanOrEqual(0.04);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/category-taxonomy.test.mjs`
Expected: 4 failures in "night edition (dark) stays calm" — `--border 1.61:1`, `--foreground 14.63:1`, a `--cat-*` saturation above 40, grain `0.08`. The existing 14 tests still pass.

- [ ] **Step 3: Retune the `.dark` tokens** in `src/app/globals.css`. Replace each line exactly:

```css
/* line 62 */    --foreground: 40 25% 88%;            →    --foreground: 40 16% 79%;
/* line 64 */    --card-foreground: 40 25% 88%;       →    --card-foreground: 40 16% 79%;
/* line 66 */    --popover-foreground: 40 25% 88%;    →    --popover-foreground: 40 16% 79%;
/* line 67 */    --primary: 40 25% 88%;               →    --primary: 40 16% 79%;
/* line 70 */    --secondary-foreground: 40 25% 88%;  →    --secondary-foreground: 40 16% 79%;
/* line 78 */    --border: 30 6% 22%;                 →    --border: 30 6% 38%;
/* line 83 */    --cat-scholarships: 212 70% 72%;     →    --cat-scholarships: 212 32% 70%;
/* line 84 */    --cat-competitions: 10 85% 70%;      →    --cat-competitions: 10 38% 70%;
/* line 85 */    --cat-summer-programs: 30 85% 66%;   →    --cat-summer-programs: 30 38% 66%;
/* line 86 */    --cat-research: 262 65% 78%;         →    --cat-research: 262 28% 76%;
/* line 87 */    --cat-volunteer: 150 45% 60%;        →    --cat-volunteer: 150 26% 62%;
/* line 88 */    --cat-stem: 188 60% 60%;             →    --cat-stem: 188 30% 62%;
/* line 90 */    --cat-workshops: 334 70% 74%;        →    --cat-workshops: 334 30% 72%;
```

Leave `--cat-internships`, `--cat-other`, `--accent`, `--gold`, `--muted-foreground` and every `:root` value untouched.

Line 197:

```css
.dark .paper-grain { opacity: 0.08; mix-blend-mode: screen; }
```
→
```css
.dark .paper-grain { opacity: 0.035; mix-blend-mode: screen; }
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/category-taxonomy.test.mjs`
Expected: 18 passed. The pre-existing "every --cat-* color reaches 4.5:1" test also re-verifies the new dark hues (7.61–9.24:1).

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css tests/category-taxonomy.test.mjs
git commit -F - <<'MSG'
Calm the night edition: softer ink, dividers that divide, quieter colour

Hairlines rise from 1.61:1 to 3.06:1 so stories and columns separate; display
ink drops from 14.6:1 to 11.7:1 to stop large type glaring; the seven vivid
category hues lose half their saturation; the screen-blended grain is halved.
Tests pin each so the night edition cannot drift back.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 2: Retire `.columns-news` — one column, readable measure

**Files:**
- Create: `tests/reading-measure.test.mjs`
- Modify: `src/app/globals.css:174-175`, `src/app/HomeClient.tsx:490,653`, `src/app/event/[id]/EventClient.tsx:293`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing later tasks use.

- [ ] **Step 1: Write the failing test** — create `tests/reading-measure.test.mjs`:

```js
/**
 * Body text runs in one column. CSS multi-column balances text at its
 * midpoint, so short paragraphs were cut mid-clause ("…balki | ular haqida…",
 * "…jahon | darajasidagi…"), and on the web long text in columns makes readers
 * scroll back up. Event overviews sampled live were 23–117 words: all short.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(tsx?|css)$/.test(name) ? [p] : [];
  });
}

describe('reading measure', () => {
  const files = sources(SRC);

  it('no stylesheet splits text into columns', () => {
    for (const f of files.filter((p) => p.endsWith('.css'))) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/column-count|columns-news/);
    }
  });

  it('no component uses the retired columns-news class', () => {
    for (const f of files.filter((p) => /\.tsx?$/.test(p))) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/columns-news/);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/reading-measure.test.mjs`
Expected: 2 failures — `globals.css` matches `column-count`; `HomeClient.tsx` matches `columns-news`.

- [ ] **Step 3: Delete the rule** — remove these two lines from `src/app/globals.css` (174–175):

```css
  .columns-news { column-gap: 2rem; }
  @media (min-width: 768px) { .columns-news { column-count: 2; } }
```

- [ ] **Step 4: Replace the class at its three uses**

`src/app/HomeClient.tsx:490`
```tsx
              <p className="dropcap columns-news mt-6 text-[1.05rem] leading-relaxed">{leadSummary}</p>
```
→
```tsx
              <p className="dropcap mt-6 max-w-[65ch] text-[1.05rem] leading-relaxed">{leadSummary}</p>
```

`src/app/HomeClient.tsx:653`
```tsx
          <p className="dropcap columns-news mt-7 text-lg leading-relaxed">{t.missionBody}</p>
```
→
```tsx
          <p className="dropcap mt-7 max-w-[65ch] text-lg leading-relaxed">{t.missionBody}</p>
```

`src/app/event/[id]/EventClient.tsx:293`
```tsx
              <p className="dropcap columns-news whitespace-pre-wrap text-lg leading-relaxed md:text-[1.2rem]">
```
→
```tsx
              <p className="dropcap max-w-[65ch] whitespace-pre-wrap text-lg leading-relaxed md:text-[1.2rem]">
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/reading-measure.test.mjs`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/app/HomeClient.tsx "src/app/event/[id]/EventClient.tsx" tests/reading-measure.test.mjs
git commit -F - <<'MSG'
Run body text in one column, so a thought is no longer cut in half

The two-column rule balanced every paragraph at its midpoint, splitting the
mission, the lead summary and event overviews mid-clause. All three now run
as a single column capped at 65ch; the drop cap is unaffected.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 3: Newspaper labels and a borderless motto

**Files:**
- Create: `tests/copy-voice.test.ts`
- Modify: `src/lib/translations.ts:72,143,145,154,327,398,400,409,582,653,655,664`, `src/app/opengraph-image.tsx:11`

**Interfaces:**
- Consumes: `translations` from `src/lib/translations.ts`.
- Produces: `tests/copy-voice.test.ts`, which Task 4 extends.

- [ ] **Step 1: Write the failing test** — create `tests/copy-voice.test.ts`:

```ts
/**
 * The paper's voice. The editorial section is labelled the way a newspaper
 * labels its own statement ("From the editors"), not like a landing page
 * ("Our mission", "Why Fursatly?"), and the masthead motto names no place.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { translations } from '../src/lib/translations';

const expected = {
  en: { missionLead: 'From the editors', whyFursatly: 'How we work', heroKicker: 'No borders. Only deadlines.' },
  uz: { missionLead: 'Tahririyatdan', whyFursatly: 'Qanday ishlaymiz', heroKicker: "Chegara yo'q. Faqat muddat bor." },
  ru: { missionLead: 'От редакции', whyFursatly: 'Как мы работаем', heroKicker: 'Без границ. Только дедлайны.' },
} as const;

describe('editorial voice', () => {
  for (const [loc, keys] of Object.entries(expected)) {
    it(`${loc}: editorial labels and motto`, () => {
      const t = translations[loc as keyof typeof translations];
      expect(t.missionLead, `${loc}.missionLead`).toBe(keys.missionLead);
      expect(t.whyFursatly, `${loc}.whyFursatly`).toBe(keys.whyFursatly);
      expect(t.heroKicker, `${loc}.heroKicker`).toBe(keys.heroKicker);
      // Not rendered anywhere today; kept in step so it cannot bring a region back.
      expect(t.footerTagline, `${loc}.footerTagline`).toBe(keys.heroKicker);
    });
  }

  it('the share card carries the motto', () => {
    const og = readFileSync(new URL('../src/app/opengraph-image.tsx', import.meta.url), 'utf8');
    expect(og).toContain("const STRIP = 'No borders. Only deadlines.';");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/copy-voice.test.ts`
Expected: 4 failures (en, uz, ru, share card).

- [ ] **Step 3: Update translations** in `src/lib/translations.ts`. Replace each line exactly:

```ts
/* 72  */    footerTagline: 'Built for the youth of Central Asia',
         →    footerTagline: 'No borders. Only deadlines.',
/* 143 */    heroKicker: 'For the students of Central Asia',
         →    heroKicker: 'No borders. Only deadlines.',
/* 145 */    missionLead: 'Our mission',
         →    missionLead: 'From the editors',
/* 154 */    whyFursatly: 'Why Fursatly?',
         →    whyFursatly: 'How we work',
/* 327 */    footerTagline: 'O\'zbekiston yoshlari uchun tayyorlandi',
         →    footerTagline: 'Chegara yo\'q. Faqat muddat bor.',
/* 398 */    heroKicker: 'Markaziy Osiyo talabalari uchun',
         →    heroKicker: 'Chegara yo\'q. Faqat muddat bor.',
/* 400 */    missionLead: 'Bizning maqsad',
         →    missionLead: 'Tahririyatdan',
/* 409 */    whyFursatly: 'Nima uchun Fursatly?',
         →    whyFursatly: 'Qanday ishlaymiz',
/* 582 */    footerTagline: 'Создано для молодёжи Центральной Азии',
         →    footerTagline: 'Без границ. Только дедлайны.',
/* 653 */    heroKicker: 'Для студентов Центральной Азии',
         →    heroKicker: 'Без границ. Только дедлайны.',
/* 655 */    missionLead: 'Наша миссия',
         →    missionLead: 'От редакции',
/* 664 */    whyFursatly: 'Почему Fursatly?',
         →    whyFursatly: 'Как мы работаем',
```

- [ ] **Step 4: Update the share card strip** — `src/app/opengraph-image.tsx:11`:

```tsx
const STRIP = 'For the students of Central Asia';
```
→
```tsx
const STRIP = 'No borders. Only deadlines.';
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/copy-voice.test.ts tests/translations.test.mjs`
Expected: all pass (translations parity unaffected — only values changed).

- [ ] **Step 6: Commit**

```bash
git add src/lib/translations.ts src/app/opengraph-image.tsx tests/copy-voice.test.ts
git commit -F - <<'MSG'
Give the editorial section a newspaper's labels and the masthead a borderless motto

"Our mission" and "Why Fursatly?" become "From the editors" and "How we work",
the way the rest of the paper speaks. "For the students of Central Asia"
becomes "No borders. Only deadlines." in the masthead, the share card and the
unused footer tagline — in English, Uzbek and Russian.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 4: Location-free descriptions

**Files:**
- Modify: `tests/copy-voice.test.ts` (append), `src/lib/translations.ts:63,318,573`, `src/app/layout.tsx:47,53`, `src/lib/event-meta.ts:25`, `src/app/opengraph-image.tsx:6`

**Interfaces:**
- Consumes: `tests/copy-voice.test.ts` from Task 3 (its imports of `readFileSync` and `translations`).
- Produces: nothing.

- [ ] **Step 1: Write the failing test** — append to `tests/copy-voice.test.ts`:

```ts
// Anything a visitor or a link preview shows. The mentor's system prompt and
// README.md may still name the audience: neither is displayed.
const PLACE = /central asia|markaziy osiyo|центральн\S*\s+ази/iu;

describe('no region on display', () => {
  it('no translation string names a region', () => {
    for (const [loc, dict] of Object.entries(translations)) {
      for (const [k, v] of Object.entries(dict)) {
        expect(String(v), `${loc}.${k}`).not.toMatch(PLACE);
      }
    }
  });

  it('page metadata, per-event descriptions and the share card name no region', () => {
    for (const f of ['../src/app/layout.tsx', '../src/lib/event-meta.ts', '../src/app/opengraph-image.tsx']) {
      expect(readFileSync(new URL(f, import.meta.url), 'utf8'), f).not.toMatch(PLACE);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/copy-voice.test.ts`
Expected: 2 failures — `en.footerDesc` (and uz, ru) and `layout.tsx`.

- [ ] **Step 3: Footer descriptions** in `src/lib/translations.ts`:

```ts
/* 63  */    footerDesc: 'Connecting young people across Central Asia with scholarships, competitions, and opportunities.',
         →    footerDesc: 'Scholarships, competitions and programs from around the world — found, researched and put in your language.',
/* 318 */    footerDesc: 'O\'zbekiston va Markaziy Osiyo yoshlari uchun eng yaxshi imkoniyatlarni to\'playmiz.',
         →    footerDesc: 'Dunyo bo\'ylab grantlar, musobaqalar va dasturlarni topamiz, o\'rganamiz va tilingizga o\'giramiz.',
/* 573 */    footerDesc: 'Соединяем молодёжь Центральной Азии со стипендиями, конкурсами и возможностями.',
         →    footerDesc: 'Стипендии, конкурсы и программы со всего мира — находим, изучаем и переводим на твой язык.',
```

- [ ] **Step 4: Site metadata** — `src/app/layout.tsx`:

```tsx
/* 47 */  description: 'AI-curated scholarships, competitions, fellowships and programs for Central Asian students. Every opportunity, researched and translated.',
       →  description: 'AI-curated scholarships, competitions, fellowships and programs from around the world. Every opportunity, researched and translated.',
/* 53 */    description: 'AI-curated scholarships, competitions, fellowships and programs for Central Asian students.',
       →    description: 'AI-curated scholarships, competitions, fellowships and programs from around the world.',
```

- [ ] **Step 5: Per-event fallback** — `src/lib/event-meta.ts:25`:

```ts
    `Discover scholarships, competitions and programs for Central Asian students on ${SITE}.`;
```
→
```ts
    `Discover scholarships, competitions and programs from around the world on ${SITE}.`;
```

- [ ] **Step 6: Share card alt text** — `src/app/opengraph-image.tsx:6`:

```tsx
export const alt = 'Fursatly — opportunities for Central Asian students';
```
→
```tsx
export const alt = 'Fursatly — scholarships, competitions and programs from around the world';
```

- [ ] **Step 7: Run to verify it passes**

Run: `npx vitest run tests/copy-voice.test.ts tests/event-meta.test.ts tests/translations.test.mjs`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/translations.ts src/app/layout.tsx src/lib/event-meta.ts src/app/opengraph-image.tsx tests/copy-voice.test.ts
git commit -F - <<'MSG'
Describe the site without naming a region: footer, metadata and share card

What visitors and link previews see now says "from around the world". The
mentor's system prompt still knows its audience; it is never displayed.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 5: Verify in the real app

**Files:** none changed unless a check fails.

- [ ] **Step 1: Full suite, types, production build**

Run: `npm test --silent && npm run typecheck && npm run build`
Expected: all test files pass (17 existing + `reading-measure`, `copy-voice`); typecheck clean; build completes (uses `.env.local`).

- [ ] **Step 2: Live visual check** — `npm run dev`, open `http://localhost:3000` in the browser pane. At widths 768, 1024 and 1440, in **both** themes:
  - Front page: lead summary and "From the editors" body are one column, drop cap intact, lines ≤ ~65 characters wide.
  - Masthead motto reads "No borders. Only deadlines." (UZ: "Chegara yo'q. Faqat muddat bor.", RU: "Без границ. Только дедлайны.").
  - Editorial labels read "From the editors" / "How we work" in each language.
  - Dark only: dividers between rail items are visible, category labels are muted, headlines are softer cream, no grain shimmer.
  - Light: identical to before apart from the copy and single-column changes.
  - An event page (`/event/chevening-scholarship`): overview is one column.

- [ ] **Step 3: Region check on rendered output**

Run: `grep -rn -i -E "central asia|markaziy osiyo|центральн" src --include='*.ts' --include='*.tsx'`
Expected: exactly one hit, `src/lib/mentor-prompt.ts` (never displayed).
