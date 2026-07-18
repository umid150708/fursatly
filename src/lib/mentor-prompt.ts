/**
 * Pure prompt composition for the opportunity mentor. No I/O — the route feeds
 * it an event row + the caller's profile and gets back a single flattened prompt
 * string suitable for the existing single-string LLM clients.
 */

export type ChatRole = 'user' | 'assistant';
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface MentorEvent {
  title: string;
  deadline?: string | null;
  organisation?: string | null;
  officialWebsite?: string | null;
  extendedDescription?: string | null;
  keyDetails?: string[];
  benefits?: string[];
  eligibility?: string[];
}

export interface MentorProfile {
  display_name?: string | null;
  age?: number | null;
  country?: string | null;
  interests?: string[] | null;
  savedCount?: number;
}

const MAX_HISTORY_MESSAGES = 16; // ~8 exchanges — bounds token cost
const LANG_NAME: Record<'en' | 'uz' | 'ru', string> = {
  en: 'English',
  uz: 'Uzbek',
  ru: 'Russian',
};

/** A research list item may be a plain string or an object — normalise to text. */
const asText = (x: any): string =>
  (typeof x === 'string' ? x : x?.value || x?.text || x?.detail || x?.description || x?.name || '')
    .toString()
    .trim();

const cleanList = (items: any): string[] =>
  Array.isArray(items) ? items.map(asText).filter((s) => s.length > 0) : [];

/** Trim a stored timestamp (e.g. "2026-07-31T00:00:00") down to its date part.
 *  String-based, so it never shifts across a timezone the way Date parsing can. */
const formatDeadline = (raw: string): string => {
  const m = /^\d{4}-\d{2}-\d{2}/.exec(raw);
  return m ? m[0] : raw;
};

/** Keep only the most recent messages so long chats stay within token budget. */
export function trimHistory(messages: ChatMessage[], maxMessages = MAX_HISTORY_MESSAGES): ChatMessage[] {
  return messages.slice(-maxMessages);
}

/** Map a raw Supabase event row (+ research_data) into clean mentor facts. */
export function extractMentorEvent(row: any): MentorEvent {
  const rd = row?.research_data ?? {};
  return {
    title: row?.title ?? '',
    deadline: row?.deadline ?? null,
    organisation: rd.organisation ?? null,
    officialWebsite: rd.officialWebsite ?? null,
    extendedDescription: rd.extendedDescription ?? row?.description ?? null,
    keyDetails: cleanList(rd.keyDetails),
    benefits: cleanList(rd.competitionTips ?? rd.eventTips),
    eligibility: cleanList(rd.eligibilityCriteria),
  };
}

function factLines(event: MentorEvent): string {
  const lines: string[] = [`Title: ${event.title}`];
  if (event.organisation) lines.push(`Organiser: ${event.organisation}`);
  if (event.deadline) lines.push(`Application deadline: ${formatDeadline(event.deadline)}`);
  if (event.officialWebsite) lines.push(`Official website: ${event.officialWebsite}`);
  if (event.extendedDescription) lines.push(`About: ${event.extendedDescription}`);
  if (event.keyDetails?.length) lines.push(`Key details: ${event.keyDetails.join('; ')}`);
  if (event.benefits?.length) lines.push(`Benefits: ${event.benefits.join('; ')}`);
  if (event.eligibility?.length) lines.push(`Eligibility: ${event.eligibility.join('; ')}`);
  return lines.join('\n');
}

function profileLines(profile: MentorProfile | null): string {
  if (!profile) return 'No profile details available.';
  const lines: string[] = [];
  if (profile.display_name) lines.push(`Name: ${profile.display_name}`);
  if (profile.age != null) lines.push(`Age: ${profile.age}`);
  if (profile.country) lines.push(`Country: ${profile.country}`);
  if (profile.interests?.length) lines.push(`Interests: ${profile.interests.join(', ')}`);
  if (profile.savedCount != null) lines.push(`Saved opportunities: ${profile.savedCount}`);
  return lines.length ? lines.join('\n') : 'No profile details available.';
}

export function buildMentorPrompt(input: {
  event: MentorEvent;
  profile: MentorProfile | null;
  messages: ChatMessage[];
  locale: 'en' | 'uz' | 'ru';
}): string {
  const { event, profile, messages, locale } = input;
  const transcript = trimHistory(messages)
    .map((m) => `${m.role === 'user' ? 'Student' : 'Mentor'}: ${m.content}`)
    .join('\n');

  return [
    'You are Fursatly Mentor, a warm and practical guide for Central Asian students exploring scholarships, competitions, and study-abroad opportunities.',
    '',
    'THE OPPORTUNITY THE STUDENT IS VIEWING:',
    factLines(event),
    '',
    'ABOUT THE STUDENT:',
    profileLines(profile),
    '',
    'RULES:',
    '- Help with education, opportunities, studying abroad, and careers. If the student asks something clearly unrelated, gently steer back to how you can help.',
    '- Ground any claim about THIS opportunity in the facts above. Never invent deadlines, eligibility, or links. If a detail is not provided, say so and point them to the official website.',
    '- When the facts above include an application deadline, state it plainly — do not claim it is unknown.',
    '- If you are unsure, say so instead of guessing.',
    `- Reply in ${LANG_NAME[locale]}.`,
    '- Be concise and give actionable next steps.',
    '',
    'CONVERSATION SO FAR:',
    transcript,
    '',
    'Mentor:',
  ].join('\n');
}
