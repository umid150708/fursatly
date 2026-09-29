/**
 * Chat LLM entry point. Unlike the pipeline's callLLM (Groq-first), the mentor
 * prefers Gemini: it handles Uzbek/Russian better and doesn't contend with the
 * Groq-heavy enrichment cron. Falls back to Groq; throws only if all fail.
 */
import { GeminiClient, geminiKeys } from './gemini';
import { groq } from './groq';

/**
 * Gemini for a student waiting on an answer: 8s per request and 9s overall, so
 * a slow model (gemini-3.5-flash took 8–27s on 30 Sep 2026) gives way to Groq
 * inside the route's 30s limit, while a fast 429/503 still tries the next key.
 */
const mentorGemini = new GeminiClient(geminiKeys(), undefined, { timeoutMs: 8_000, budgetMs: 9_000 });

export interface LLMProvider {
  call(prompt: string, maxTokens?: number): Promise<string>;
  available?: boolean;
}

export async function mentorLLM(
  prompt: string,
  maxTokens = 600,
  providers: LLMProvider[] = [mentorGemini, groq],
): Promise<string> {
  let lastErr: unknown;
  for (const provider of providers) {
    if (provider.available === false) continue;
    try {
      return await provider.call(prompt, maxTokens);
    } catch (err) {
      lastErr = err;
      console.warn('[mentorLLM] provider failed, trying next:', err instanceof Error ? err.message : err);
    }
  }
  throw lastErr ?? new Error('No mentor LLM providers available');
}
