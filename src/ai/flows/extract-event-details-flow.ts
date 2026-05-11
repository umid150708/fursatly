'use server';
/**
 * @fileOverview Extracts structured event data from raw Telegram post text.
 *
 * Uses Groq (llama-3.3-70b-versatile) with key rotation and OpenRouter fallback.
 * Gemini / Genkit removed entirely — all quota was exhausted.
 *
 * URLs and contact info are pre-extracted from the raw post text for free (regex),
 * then passed to Groq as explicit context so no extra LLM lookup is needed for
 * the apply link — Groq just picks from the provided list.
 */

import { callLLM, parseJSON } from '@/pipeline/groq';

export interface ExtractEventDetailsInput {
  text: string;
}

export interface ExtractEventDetailsOutput {
  is_valid_opportunity: boolean;
  title: string;
  description: string;
  location: string;
  age: { min: number | null; max: number | null };
  language: string;
  deadline: string | null;
  category: 'Scholarships' | 'Competitions' | 'Summer Programs' | 'Research' | 'Volunteer' | 'STEM' | 'Internships' | 'Workshops' | string;
  apply_url: string | null;
}

/**
 * Pull every actionable URL / email / handle out of raw post text — no Groq needed.
 * Covers: http(s) links, emails, t.me/* links, @username handles, bare domains.
 */
function extractContactInfo(text: string): string[] {
  const found = new Set<string>();

  // Full URLs
  const urls = text.match(/https?:\/\/[^\s\)\]>"']+/g) ?? [];
  urls.forEach(u => found.add(u.replace(/[.,;:!?]+$/, '')));

  // Email addresses
  const emails = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [];
  emails.forEach(e => found.add(e));

  // Telegram channel/bot links (t.me/foo)
  const tmeLinks = text.match(/(?:^|[\s(])t\.me\/[A-Za-z0-9_]{3,}/g) ?? [];
  tmeLinks.forEach(t => found.add('https://' + t.trim()));

  // Bare @usernames (Telegram/Instagram/etc) — must be 3+ chars and NOT preceded by a word char (so we don't grab the local part of an email)
  const handles = text.match(/(?:^|[\s(,!.])@([A-Za-z0-9_]{3,})\b/g) ?? [];
  handles.forEach(h => found.add('@' + h.trim().replace(/^[^@]*@/, '')));

  // Bare domains like example.com or www.example.com (no protocol prefix)
  const bareDomains = text.match(/(?:^|\s)((?:www\.)?[a-z0-9][a-z0-9\-]+\.(?:com|org|net|edu|io|uz|ru|co|gov|info|app|ai)(?:\/[^\s]*)?)/gi) ?? [];
  bareDomains.forEach(d => found.add(d.trim()));

  return [...found];
}

const EXTRACTION_PROMPT = (text: string, contactInfo: string[]) => `You are an event extraction engine for Fursatly, an opportunity platform for Uzbek students.

Extract structured data from this Telegram post. Return ONLY valid JSON — no markdown, no explanation.
${contactInfo.length > 0 ? `
URLs / contacts found in this post (use these directly — do not invent others):
${contactInfo.map(c => '  • ' + c).join('\n')}
` : ''}
Schema:
{
  "is_valid_opportunity": boolean,
  "title": string,
  "description": string,
  "location": string,
  "age": { "min": number | null, "max": number | null },
  "language": "English" | "Uzbek" | "Russian",
  "deadline": "YYYY-MM-DD" | null,
  "category": "Scholarships" | "Competitions" | "Summer Programs" | "Research" | "Volunteer" | "STEM" | "Internships" | "Workshops",
  "apply_url": string | null
}

Rules:
- is_valid_opportunity = false if ANY of these apply:
  • It is an ad, spam, self-promotion, or unrelated chat
  • The post contains NO URL, NO email, NO t.me/ link, NO @handle, and NO bare domain — i.e. the "URLs / contacts found" list above is empty. A student must have a way to act on it remotely.
  • It is purely informational (e.g. "here is a list of deadlines") with no single apply-able opportunity
- is_valid_opportunity = true ONLY if the "URLs / contacts found" list above is non-empty AND the post describes a real opportunity (scholarship, competition, program, internship, etc.)
- apply_url: REQUIRED whenever is_valid_opportunity is true. Pick the single best entry from the "URLs / contacts found" list:
    1. Prefer an official program/application URL (https://...)
    2. Else prefer an organiser email
    3. Else prefer a t.me/ link
    4. Else fall back to an @handle (prefix it with https://t.me/ if it looks like a Telegram channel)
  If is_valid_opportunity is false, set apply_url to null.
- title: use original if present, otherwise write a short factual title — NEVER marketing language
- location: country or city if clearly stated, otherwise "International" or "Online"
- deadline: ISO date (YYYY-MM-DD) ONLY if explicitly stated in the post — otherwise null
- age.min / age.max: only if explicitly stated — otherwise null
- language: the language the event itself is conducted in, not the post language
- category: pick the single best match from the allowed list
- NEVER invent information — if uncertain, return null for that field

Post:
${text}`;

export async function extractEventDetails(
  input: ExtractEventDetailsInput,
): Promise<ExtractEventDetailsOutput> {
  const contactInfo = extractContactInfo(input.text);
  const raw = await callLLM(EXTRACTION_PROMPT(input.text, contactInfo), 600);
  return parseJSON<ExtractEventDetailsOutput>(raw);
}
