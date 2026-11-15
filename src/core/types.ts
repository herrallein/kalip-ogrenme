export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export interface Example { de: string; tr: string }
export interface Pattern {
  id: string;            // 'a1-ich-moechte' gibi, küçük harf, ascii, tekil
  level: Level;
  priority: number;      // düzey içinde 1'den başlar, küçük olan önce
  pattern: string;       // 'Ich möchte … (Infinitiv)'
  meaning: string;       // Türkçe anlam: '… istiyorum (kibar)'
  note?: string;         // kısa dilbilgisi notu (Türkçe), en çok 1-2 cümle
  examples: Example[];   // en az 4, en çok 8
}
export type Grade = 'hard' | 'good' | 'easy';
export type Phase = 'learning' | 'review';
export interface Progress {
  id: string; phase: Phase;
  introduced: string;    // ilk görüldüğü gün
  easyStreak: number;    // öğrenme evresinde art arda 'easy' sayısı
  step: number;          // kalıcılık evresinde reviewIntervals indeksi
  due: string;           // sıradaki gün (YYYY-MM-DD)
  seen: number; lapses: number; lastSeen?: string;
  history: { date: string; grade: Grade }[];
  sentences: { date: string; text: string }[];   // kullanıcının kendi kurduğu cümleler
}
export interface Settings {
  newPerDay: number;            // 3
  learningCap: number;          // 9
  easyStreakToGraduate: number; // 3
  reviewIntervals: number[];    // [3, 7, 21, 60, 120]
}
export interface DayRecord { newIds: string[]; done: string[] }
export interface AppState {
  version: 1;
  settings: Settings;
  progress: Record<string, Progress>;
  days: Record<string, DayRecord>;
  order: string[];              // kullanıcı sıralaması; boşsa düzey + priority
}
export type QueueKind = 'new' | 'learning' | 'review';
export interface QueueItem { id: string; kind: QueueKind }
