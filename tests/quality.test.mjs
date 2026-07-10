/** Unit tests for the shared enrichment quality rules. */
import { describe, it, expect } from 'vitest';
import { detectFunding, qualityGate } from '../src/pipeline/quality.mjs';

describe('detectFunding', () => {
  it('detects Full from any language signal', () => {
    expect(detectFunding({ extendedDescription: 'This is a fully funded fellowship.' })).toBe('Full');
    expect(detectFunding({ keyDetails: ["To'liq grant beriladi"] })).toBe('Full');
    expect(detectFunding({ competitionTips: ['полное финансирование доступно'] })).toBe('Full');
  });
  it('detects Partial', () => {
    expect(detectFunding({ extendedDescription: 'Partial scholarships are available.' })).toBe('Partial');
  });
  it('Full wins when both appear', () => {
    expect(detectFunding({ extendedDescription: 'fully funded, partial travel help' })).toBe('Full');
  });
  it('null when no signals', () => {
    expect(detectFunding({ extendedDescription: 'A great opportunity.' })).toBeNull();
  });
});

describe('qualityGate', () => {
  const research = { is_opportunity: true };
  it('rejects short titles', () => {
    expect(qualityGate({ title: 'Short', deadline: null }, research).pass).toBe(false);
  });
  it('rejects passed deadlines', () => {
    const r = qualityGate({ title: 'A real opportunity title', deadline: '2020-01-01' }, research);
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/Deadline passed/);
  });
  it('rejects non-opportunities (awards ceremonies etc.)', () => {
    const r = qualityGate({ title: 'A real opportunity title', deadline: null }, { is_opportunity: false });
    expect(r.pass).toBe(false);
  });
  it('passes a valid event', () => {
    const future = new Date(Date.now() + 86_400_000 * 30).toISOString();
    expect(qualityGate({ title: 'A real opportunity title', deadline: future }, research).pass).toBe(true);
  });
});
