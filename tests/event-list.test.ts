/** Unit tests for the trimmed homepage list row mapping — pure. */
import { describe, it, expect } from 'vitest';
import { EVENT_LIST_SELECT, mapEventListRow } from '../src/lib/event-list';

describe('EVENT_LIST_SELECT', () => {
  it('never pulls the whole research_data blob', () => {
    expect(EVENT_LIST_SELECT).not.toMatch(/(^|,)research_data(,|$)/);
  });
  it('keeps the columns the homepage filters on', () => {
    for (const col of ['id', 'title', 'deadline', 'language', 'age_min', 'age_max', 'source']) {
      expect(EVENT_LIST_SELECT).toContain(col);
    }
  });
});

describe('mapEventListRow', () => {
  it('folds aliased leaves back into the research_data shape components expect', () => {
    const mapped = mapEventListRow({
      id: '1',
      title: 'Chevening',
      funding_type: 'Full',
      uz_title: 'Chevening UZ',
      ru_title: 'Chevening RU',
    });
    expect(mapped.research_data.funding_type).toBe('Full');
    expect(mapped.research_data.translations.uz.title).toBe('Chevening UZ');
    expect(mapped.research_data.translations.ru.title).toBe('Chevening RU');
    expect(mapped.funding_type).toBeUndefined();
    expect(mapped.uz_title).toBeUndefined();
    expect(mapped.title).toBe('Chevening');
  });

  it('handles missing translations and funding gracefully', () => {
    const mapped = mapEventListRow({ id: '2', title: 'X' });
    expect(mapped.research_data.funding_type).toBeNull();
    expect(mapped.research_data.translations.uz).toBeUndefined();
    // the optional-chain reads in components must not throw
    expect(mapped.research_data?.translations?.uz?.title || mapped.title).toBe('X');
  });
});
