/* =========================================================
   Adaptive practice engine (ported from v1 spelling):
   weaker, recently-missed items come up more often; items
   just seen or well mastered step back. Shared by the
   spelling trainer and the secondary vocabulary trainer.
   Callers own where the stat objects are stored and saved.
   ========================================================= */

export function newStat(key) {
  return {
    key, attempts: 0, correct: 0, wrong: 0,
    mastery: 0, wrongStreak: 0, lastSeenAt: 0, lastResult: null
  };
}

export function computeWeight(stat, now = Date.now()) {
  let weight = 0.2 + 1.2 * (1 - stat.mastery);
  weight += 0.35 * Math.min(stat.wrongStreak, 6);
  if (stat.attempts > 0) weight += 0.8 * (stat.wrong / stat.attempts);

  const age = now - stat.lastSeenAt;
  if (age < 6000) weight *= 0.15;
  else if (age < 15000) weight *= 0.45;

  if (stat.mastery > 0.9) weight *= 0.15;
  else if (stat.mastery > 0.8) weight *= 0.35;

  return Math.max(0.02, weight);
}

export function weightedPick(stats) {
  const now = Date.now();
  const weights = stats.map(s => computeWeight(s, now));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < stats.length; i++) {
    r -= weights[i];
    if (r <= 0) return stats[i];
  }
  return stats[stats.length - 1];
}

export function applyResult(stat, ok) {
  stat.attempts++;
  stat.lastSeenAt = Date.now();
  stat.lastResult = ok;
  if (ok) {
    stat.correct++;
    stat.wrongStreak = 0;
    stat.mastery = Math.min(1, stat.mastery + (stat.mastery < 0.6 ? 0.22 : stat.mastery < 0.8 ? 0.14 : 0.08));
  } else {
    stat.wrong++;
    stat.wrongStreak++;
    stat.mastery = Math.max(0, stat.mastery - (stat.mastery > 0.6 ? 0.18 : 0.12));
  }
}
