/** The queue must drop skippable rows in SQL, before its LIMIT (see enrich-queue.ts). */
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { enrichQueueQuery, MAX_ATTEMPTS } from '../src/pipeline/enrich-queue';

describe('enrichQueueQuery', () => {
  const url = new URL((enrichQueueQuery(createClient('http://db.test', 'anon'), 6) as any).url);
  const params = url.searchParams;

  it('skips retired duplicates, rejected adverts and exhausted listings before limiting', () => {
    expect(params.get('is_active')).toBe('eq.false');
    expect(params.get('research_data->>duplicate_of')).toBe('is.null');
    expect(params.get('research_data->>rejected')).toBe('is.null');
    expect(params.get('or')).toBe(
      `(research_data->_attempts.is.null,research_data->_attempts.lt.${MAX_ATTEMPTS})`,
    );
    expect(params.get('limit')).toBe('6');
    expect(params.get('order')).toBe('created_at.asc');
  });
});
