/**
 * Fursatly — enrichment quality rules, in ONE place.
 *
 * Shared by the serverless pipeline (src/pipeline/enrich.ts) and the local
 * bulk runner (scripts/bulk-enrich.mjs), like prompts.mjs. Pure functions,
 * no imports — identical under Next's bundler and bare `node`.
 */

/**
 * Detect funding coverage from the enriched text signals.
 * @returns {'Full' | 'Partial' | null}
 */
export function detectFunding(research) {
  const text = [
    research.extendedDescription ?? '',
    ...(research.keyDetails ?? []),
    ...(research.eligibilityCriteria ?? []),
    ...(research.competitionTips ?? []),
  ].join(' ').toLowerCase();

  const fullSignals = [
    'fully funded', 'full fund', 'full scholarship', 'full grant', 'full coverage',
    'covers all', 'all expenses', 'all costs covered', "to'liq grant",
    "to'liq moliyalashtirish", 'полное финансирование',
    'stipend included', 'flight covered', 'accommodation covered', 'travel covered', '100%',
  ];
  const partialSignals = [
    'partial', 'qisman', 'частичное', 'contribution',
    'co-funded', 'partially covered', 'some expenses',
  ];

  if (fullSignals.some(s => text.includes(s))) return 'Full';
  if (partialSignals.some(s => text.includes(s))) return 'Partial';
  return null;
}

/**
 * Gate an event before activation: real title, live deadline, genuinely an
 * opportunity a student applies to (not an awards ceremony / passive event).
 * @param {{ title: string, deadline: string | null }} event
 * @returns {{ pass: boolean, reason: string }}
 */
export function qualityGate(event, research) {
  if (!event.title || event.title.trim().length < 8) {
    return { pass: false, reason: `Title too short: "${event.title}"` };
  }
  if (event.deadline) {
    const dl = new Date(event.deadline);
    if (!isNaN(dl.getTime()) && dl < new Date()) {
      return { pass: false, reason: `Deadline passed: ${event.deadline}` };
    }
  }
  if (research.is_opportunity === false) {
    return { pass: false, reason: `Not a genuine opportunity (awards ceremony / passive event): "${event.title}"` };
  }
  return { pass: true, reason: '' };
}
