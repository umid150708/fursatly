/**
 * Fursatly — the enrichment LLM prompts, in ONE place.
 *
 * Shared by the serverless pipeline (src/pipeline/enrich.ts) and the local
 * bulk runner (scripts/bulk-enrich.mjs). These two used to carry their own
 * copies, which had already started to drift — any prompt change must land
 * here and nowhere else.
 *
 * Plain ESM with no imports so it runs identically under Next's bundler and
 * bare `node`.
 */

/** The core research prompt: extract structured facts about one opportunity. */
export function researchPrompt(title, description) {
  return `You are a research assistant for Fursatly, an opportunity platform for Uzbek students.

Analyze this opportunity and return ONLY a valid JSON object. No markdown, no explanation.

Title: ${title}
Description: ${(description ?? '').slice(0, 2000) || 'Not provided'}

Return this exact shape:
{
  "is_opportunity": true,
  "extendedDescription": "2-3 punchy sentences that make a student want this. Lead with the concrete benefit (money, access, experience). Do NOT restate the title. Write like an announcement, not an encyclopedia entry.",
  "eligibilityCriteria": ["requirement 1", "requirement 2"],
  "keyDetails": ["concrete fact 1 (prize/duration/benefit)", "fact 2"],
  "competitionTips": ["actionable tip a student can do today", "tip 2"],
  "officialWebsite": "https://... or null",
  "applyLabel": "Apply on official website",
  "confidence": 0.85
}

Rules:
- extendedDescription: NEVER begin by repeating the title or the organisation name — the reader already sees it. Open on the single most compelling fact (the prize, the funding, the access). No filler like "This opportunity is a unique chance to…".
- is_opportunity: true ONLY if this is something a student actively applies to and receives a direct personal benefit from — scholarship, grant, internship, fellowship, exchange programme, competition with a prize, research programme, fully-funded trip. Set to false for: awards ceremonies where others nominate or vote for you, pure spectator events, info sessions, conferences without funding, nomination-only events, honorary recognitions. When in doubt, set false.
- eligibilityCriteria: ONLY requirements EXPLICITLY stated in the text. If none stated, return []. NEVER invent.
- keyDetails: must be SUBSTANTIVE facts — a prize amount ("$3,000 prize"), a duration ("12-week summer program"), a stipend ("monthly $800 stipend"), a class size ("400 selected participants"), a specific date range. Each entry must be ≥ 4 words OR contain a number/currency/duration unit. NEVER write vague placeholders like "this week", "next year", "International", "fully-funded", "online" on their own. If the source has no concrete numbers/dates/quantities, return [] — empty is better than fabricated.
- competitionTips: actionable steps a student can take BEFORE applying. Not "work hard". Not "be yourself". Not generic resume advice that applies to every opportunity. Each tip must be at least 6 words AND specific to THIS opportunity's domain. If the source gives you nothing program-specific, return [] — empty is better than filler.
- confidence: 0.0–1.0 based on clarity of source. If source is < 100 chars of real content, max confidence is 0.3.
- officialWebsite: the application/info URL. Check the description first — if it contains a 🔗 line, that IS the URL, copy it exactly. Otherwise use any URL in the description text. If none is present but you recognise the program, provide the correct official URL from your knowledge. Return null only if you genuinely cannot determine it.
- Arrays may be empty [] if there is genuinely nothing to add. EMPTY IS BETTER THAN FABRICATED.`;
}

/** Translate the enriched fields into Uzbek (Latin) or Russian. */
export function translationPrompt(fields, language) {
  return `Translate to ${language}. Return ONLY the JSON object, no explanation.

${JSON.stringify(fields, null, 2)}

Rules:
- Keep the same JSON keys
- Arrays must stay as arrays of strings
- Translate naturally, not word-for-word
- ${language === 'Uzbek (Latin script)' ? 'Use Latin Uzbek script, not Cyrillic' : 'Use natural Russian'}`;
}
