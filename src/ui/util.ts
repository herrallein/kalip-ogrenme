import { gradePattern } from '../core/scheduler';
import type { AppState, Grade } from '../core/types';

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function dayWord(n: number): string {
  return n <= 1 ? 'yarın' : `${n} gün sonra`;
}

// Notu deneme olarak uygular (state kaydedilmez) ve sonucu kısa metinle anlatır.
export function gradePreview(state: AppState, id: string, grade: Grade, today: string): string {
  const before = state.progress[id];
  const after = gradePattern(state, id, grade, today).progress[id];
  if (!after) return '';
  const n = daysBetween(today, after.due);
  if (after.phase === 'learning') {
    if (before?.phase === 'review') return 'öğrenmeye döner, yarın tekrar';
    return n <= 1 ? 'yarın tekrar' : `${n} gün sonra tekrar`;
  }
  if (!before || before.phase === 'learning') return `kalıcılığa geçti, ${n} gün sonra`;
  return `${n} gün sonra (kalıcı)`;
}

export const GRADES: { grade: Grade; label: string }[] = [
  { grade: 'hard', label: 'Zorlandım' },
  { grade: 'good', label: 'Düşünerek hatırladım' },
  { grade: 'easy', label: 'Kolay, rahat kurdum' },
];

export function fmtDay(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y}`;
}
