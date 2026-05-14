'use server';

import { createClient } from '@supabase/supabase-js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'meta-llama/llama-3.3-70b-instruct';
const MAX_EVENTS_PER_RUN = 10;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function callLLM(prompt: string, retries = 2): Promise<Record<string, any>> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 3000,
        }),
      });

      const json = await res.json();
      if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));

      const text = json.choices?.[0]?.message?.content || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in LLM response');
      return JSON.parse(match[0]);
    } catch (e: any) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      throw e;
    }
  }
  throw new Error('LLM call failed after retries');
}

async function enrichSingleEvent(event: any): Promise<boolean> {
  const { id, title, description, source: category, age_min, age_max } = event;

  const researchPrompt = `You are a research expert analyzing educational opportunities for students.

Title: "${title}"
Description: "${description}"
Category: ${category}
Age range: ${age_min}-${age_max}

Provide detailed, SPECIFIC research. Return ONLY valid JSON:
{
  "extendedDescription": "A detailed 3-4 sentence description of this opportunity, what it offers, and why it matters",
  "officialWebsite": "https://... (the real official application/info page URL, or null if unknown)",
  "eligibilityCriteria": ["5 specific eligibility requirements with exact details"],
  "keyDetails": ["5 specific factual details - prizes, dates, duration, format, etc."],
  "competitionTips": ["5 specific, actionable tips for success in this program"],
  "confidence": 0.8
}

Be SPECIFIC and FACTUAL. No generic advice. Every item must contain concrete information about THIS specific opportunity.`;

  const research = await callLLM(researchPrompt);
  if (!research.eligibilityCriteria?.length || !research.competitionTips?.length) {
    return false;
  }

  const translationPrompt = `Translate this JSON content to Uzbek (Latin script). Keep the same JSON structure. Return ONLY valid JSON.

{
  "title": "${title}",
  "extendedDescription": "${(research.extendedDescription || '').replace(/"/g, '\\"')}",
  "eligibilityCriteria": ${JSON.stringify(research.eligibilityCriteria)},
  "keyDetails": ${JSON.stringify(research.keyDetails)},
  "competitionTips": ${JSON.stringify(research.competitionTips)}
}`;

  let uzTranslation = null;
  try {
    uzTranslation = await callLLM(translationPrompt);
  } catch {
    // Translation failure is non-fatal
  }

  const existing = event.research_data || {};
  const updated = {
    ...existing,
    extendedDescription: research.extendedDescription || existing.extendedDescription,
    officialWebsite: research.officialWebsite || existing.officialWebsite,
    eligibilityCriteria: research.eligibilityCriteria,
    keyDetails: research.keyDetails,
    competitionTips: research.competitionTips,
    confidence: research.confidence || 0.8,
    lastEnrichedAt: new Date().toISOString(),
    translations: {
      ...(existing.translations || {}),
      ...(uzTranslation ? { uz: uzTranslation } : {}),
    },
  };

  const supabase = getSupabase();
  const { error } = await supabase
    .from('events')
    .update({ research_data: updated })
    .eq('id', id);

  return !error;
}

export async function enrichPendingEvents(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  details: Array<{ id: string; title: string; status: string }>;
}> {
  const supabase = getSupabase();

  const { data: allEvents, error } = await supabase
    .from('events')
    .select('*')
    .not('is_active', 'eq', false);

  if (error) throw new Error(`DB fetch error: ${error.message}`);

  const pending = (allEvents || []).filter(e => {
    const r = e.research_data || {};
    const tips = r.competitionTips?.length || 0;
    const elig = r.eligibilityCriteria?.length || 0;
    const details = r.keyDetails?.length || 0;
    return tips < 3 || elig < 3 || details < 3;
  }).slice(0, MAX_EVENTS_PER_RUN);

  const details: Array<{ id: string; title: string; status: string }> = [];
  let succeeded = 0;
  let failed = 0;

  for (const event of pending) {
    try {
      const ok = await enrichSingleEvent(event);
      if (ok) {
        succeeded++;
        details.push({ id: event.id, title: event.title, status: 'enriched' });
      } else {
        failed++;
        details.push({ id: event.id, title: event.title, status: 'empty_response' });
      }
    } catch (e: any) {
      failed++;
      details.push({ id: event.id, title: event.title, status: `error: ${e.message}` });
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  return { processed: pending.length, succeeded, failed, details };
}
