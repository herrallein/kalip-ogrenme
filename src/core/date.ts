// Yerel saatle 'YYYY-MM-DD' tarih yardımcıları.
const p2 = (n: number) => String(n).padStart(2, '0');

export function fmt(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function todayStr(now: Date = new Date()): string {
  return fmt(now);
}

// Ay/yıl sonu ve yaz saati geçişinde doğru: Date(y, m-1, d+n) takvim günü ekler.
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return fmt(new Date(y, m - 1, d + n));
}
