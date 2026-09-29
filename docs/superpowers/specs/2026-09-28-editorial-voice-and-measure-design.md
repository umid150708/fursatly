# Editorial voice and measure — one column, newspaper labels, a borderless motto

Date: 2026-09-28
Status: approved

## Goal

Three reader-facing fixes the operator raised while reviewing the Gazette:

1. Short paragraphs are cut in half across two columns, so one thought reads as
   two separate texts.
2. The editorial section speaks like a startup landing page ("Bizning maqsad",
   "Nima uchun Fursatly?") while the rest of the paper speaks like a newspaper
   ("Qisqacha", "Muddat tugayapti", "Muddatlar prognozi").
3. The masthead motto ties the site to one region ("For the students of Central
   Asia"). The audience may well be there; the site should not say so.

## What was measured

`.columns-news` is `column-count: 2` at ≥768px, applied regardless of length.
Multi-column balances by default, so the split falls at the text's midpoint —
mid-clause in practice:

- Mission body, 2 sentences: "…balki | ular haqida hech kim bilmagani uchun."
- Front-page lead summary: "…jahon | darajasidagi ta'lim…" ("world-class" split).
- Event overviews: sampled 12 live events — **23 to 117 words, median 46**.
  Every one is split. None is long enough for columns to help.

On the web, columns also fail long text (the reader scrolls down one column
then back up for the next), so there is no length at which they serve this site.

## Design

### 1. Retire `.columns-news`

- Remove the class from its three uses: `src/app/HomeClient.tsx` (lead summary,
  mission body) and `src/app/event/[id]/EventClient.tsx` (overview).
- Replace with a single column capped at a readable measure: `max-w-[65ch]`.
- Delete the `.columns-news` rule and its media query from `globals.css`.
- `.dropcap` is a `::first-letter` float and does not depend on columns; it stays.

### 2. Newspaper labels for the editorial section

| Key | EN | UZ | RU |
|---|---|---|---|
| `missionLead` | From the editors | Tahririyatdan | От редакции |
| `whyFursatly` | How we work | Qanday ishlaymiz | Как мы работаем |

"From the editors" is how a paper labels its own statement of purpose; the
section is already named "Editorial" in `HomeClient.tsx`. "How we work" fits the
right-hand column, which is a pipeline and numbered method, not a sales pitch.

### 3. A motto with no place in it

| Key | EN | UZ | RU |
|---|---|---|---|
| `heroKicker` (masthead motto, `SiteNav.tsx`) | No borders. Only deadlines. | Chegara yo'q. Faqat muddat bor. | Без границ. Только дедлайны. |
| `footerTagline` (defined, not rendered) | same | same | same |

`footerTagline` is dead copy — no component renders it — but it is updated so it
cannot reintroduce the phrase if someone wires it up later. The UZ value was
"O'zbekiston yoshlari uchun tayyorlandi", also place-bound.

Share card (`src/app/opengraph-image.tsx`): `STRIP` → "No borders. Only deadlines."

### 4. Location-free descriptions

| Where | New text |
|---|---|
| `footerDesc` EN | Scholarships, competitions and programs from around the world — found, researched and put in your language. |
| `footerDesc` UZ | Dunyo bo'ylab grantlar, musobaqalar va dasturlarni topamiz, o'rganamiz va tilingizga o'giramiz. |
| `footerDesc` RU | Стипендии, конкурсы и программы со всего мира — находим, изучаем и переводим на твой язык. |
| `layout.tsx` description | AI-curated scholarships, competitions, fellowships and programs from around the world. Every opportunity, researched and translated. |
| `layout.tsx` openGraph description | AI-curated scholarships, competitions, fellowships and programs from around the world. |
| `event-meta.ts` fallback | Discover scholarships, competitions and programs from around the world on ${SITE}. |
| OG image `alt` | Fursatly — scholarships, competitions and programs from around the world |

The UZ and RU wording follows the existing mission body ("topadi, o'rganadi va
… tilingizga o'giradi"; "находит, изучает и переводит на твой язык") and the
nav's word for competitions ("musobaqalar").

## Unchanged on purpose

- **The AI mentor's system prompt** (`src/lib/mentor-prompt.ts`) still calls
  itself a guide for Central Asian students. It is never displayed, and it tunes
  advice (visas, languages, local context) to the audience the site actually has.
- **`README.md`** — repository documentation, not the website.

## Trade-offs

- **Search relevance.** Meta descriptions lose "Central Asian students", so a
  search like "scholarships for Uzbek students" loses one keyword match. The
  Uzbek and Russian page content still signals the audience. Accepted: the
  operator does not want the region displayed, and Google shows descriptions.

## Acceptance

1. No rendered string contains "Central Asia", "Markaziy Osiyo" or
   "Центральной Азии": translations, `layout.tsx`, `event-meta.ts`,
   `opengraph-image.tsx` (the mentor prompt and README are the only matches).
2. Mission body, lead summary and event overview render as one column at 768,
   1024 and 1440px, with the drop cap intact and lines no longer than ~65ch.
3. Editorial labels and motto updated in all three languages.
4. Full test suite passes.
