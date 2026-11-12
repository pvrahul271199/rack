/** Epley: e1RM = w × (1 + r/30). A single rep is the weight itself. */
export function e1rm(w: number, r: number): number {
  if (w <= 0 || r <= 0) return 0;
  return r === 1 ? w : w * (1 + r / 30);
}
