/**
 * Chat LLM entry point. Unlike the pipeline's callLLM (Groq-first), the mentor
 * prefers Gemini: it handles Uzbek/Russian better and doesn't contend with the
 * Groq-heavy enrichment cron. Falls back to Groq; throws only if all fail.
 */
import { gemini } from './gemini';
import { groq } from './groq';

export interface LLMProvider {
  call(prompt: string, maxTokens?: number): Promise<string>;
  available?: boolean;
}

export async function mentorLLM(
  prompt: string,
  maxTokens = 600,
  providers: LLMProvider[] = [gemini, groq],
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
