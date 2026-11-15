import { describe, expect, it } from 'vitest';
import { addDays, todayStr } from './date';

describe('date', () => {
  it('todayStr yerel tarihi YYYY-MM-DD verir', () => {
    expect(todayStr(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('addDays ay sonunu geçer', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('addDays yıl sonunu geçer', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });
  it('addDays artık yılı bilir', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-28', 2)).toBe('2028-03-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
  it('addDays Mart yaz saati geçişinde tam gün ekler', () => {
    // AB: 2026-03-29, ABD: 2026-03-08
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
    expect(addDays('2026-03-30', -2)).toBe('2026-03-28');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });
  it('addDays 120 gün ekler', () => {
    expect(addDays('2026-11-15', 120)).toBe('2027-03-15');
  });
});
