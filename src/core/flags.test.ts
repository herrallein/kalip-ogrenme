import { describe, expect, it } from 'vitest';
import { flaggedIds, isFlagged, toggleFlag } from './flags';
import { mergeStates } from './merge';
import { emptyState } from './scheduler';

describe('toggleFlag', () => {
  it('işaretler, geri alır; boş alanları bırakmaz', () => {
    const s0 = emptyState();
    const s1 = toggleFlag(s0, 'a1-1', new Date('2026-11-01T10:00:00Z'));
    expect(isFlagged(s1, 'a1-1')).toBe(true);
    expect(s0.flags).toBeUndefined();
    const s2 = toggleFlag(s1, 'a1-1', new Date('2026-11-02T10:00:00Z'));
    expect(isFlagged(s2, 'a1-1')).toBe(false);
    expect('flags' in s2).toBe(false);
    expect(s2.flagsCleared).toEqual({ 'a1-1': '2026-11-02T10:00:00.000Z' });
  });
  it('geri alma eşitlemede diğer cihazdaki işareti siler', () => {
    const flagged = toggleFlag(emptyState(), 'a1-1', new Date('2026-11-01T10:00:00Z'));
    const cleared = toggleFlag(flagged, 'a1-1', new Date('2026-11-02T10:00:00Z'));
    expect(isFlagged(mergeStates(flagged, cleared), 'a1-1')).toBe(false);
    expect(isFlagged(mergeStates(cleared, flagged), 'a1-1')).toBe(false);
  });
  it('flaggedIds bilinmeyen kimlikleri süzer ve sıralar', () => {
    let s = toggleFlag(emptyState(), 'b', new Date());
    s = toggleFlag(s, 'a', new Date());
    s = toggleFlag(s, 'gone', new Date());
    expect(flaggedIds(s)).toEqual(['a', 'b', 'gone']);
    expect(flaggedIds(s, ['a', 'b'])).toEqual(['a', 'b']);
  });
});
