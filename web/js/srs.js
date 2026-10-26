// Spaced repetition — a compact SM-2 variant.
// grade: 0 = Again, 1 = Hard, 2 = Good, 3 = Easy

const DAY = 86400000;

export function newSrs() {
  return { due: Date.now(), ivl: 0, ease: 2.5, reps: 0, lapses: 0, last: 0 };
}

export function schedule(srs, grade, now = Date.now()) {
  const s = { ...newSrs(), ...srs };
  if (grade === 0) {
    s.reps = 0;
    s.lapses += 1;
    s.ease = Math.max(1.3, s.ease - 0.2);
    s.ivl = 0;
    s.due = now + 10 * 60 * 1000; // see it again in 10 minutes
  } else {
    s.reps += 1;
    if (s.reps === 1) s.ivl = grade === 1 ? 1 : grade === 2 ? 1 : 4;
    else if (s.reps === 2) s.ivl = grade === 1 ? 3 : grade === 2 ? 4 : 7;
    else s.ivl = Math.round(s.ivl * s.ease * (grade === 1 ? 0.75 : grade === 3 ? 1.3 : 1));
    s.ivl = Math.max(1, Math.min(s.ivl, 3650));
    if (grade === 1) s.ease = Math.max(1.3, s.ease - 0.15);
    if (grade === 3) s.ease = Math.min(3.2, s.ease + 0.15);
    // small fuzz so cards created together don't all fall on the same day
    const fuzz = s.ivl > 3 ? Math.round((Math.random() - 0.5) * s.ivl * 0.1) : 0;
    s.due = now + (s.ivl + fuzz) * DAY;
  }
  s.last = now;
  return s;
}

export function preview(srs, grade) {
  const s = schedule(srs, grade, 0);
  if (grade === 0) return '10 min';
  const d = s.ivl;
  if (d < 30) return `${d} d`;
  if (d < 365) return `${Math.round(d / 30)} mo`;
  return `${(d / 365).toFixed(1)} y`;
}

export const isDue = (card, now = Date.now()) => !card.suspended && (card.srs?.due ?? 0) <= now;
