import { DrillResult, PuttingDrill, getLevelLabel, SESSION_LEVELS } from '@/types/putting';

export function computeDrillResult(drill: PuttingDrill, counts: Record<string, number>): DrillResult {
  const rawScore = drill.scoring_inputs.reduce((sum, input) => {
    return sum + (counts[input.id] ?? 0) * input.points;
  }, 0);

  let finalScore = rawScore;
  let max = drill.max_score;
  if (drill.scaled && drill.scaled_max) {
    finalScore = Math.round((rawScore / drill.max_score) * drill.scaled_max);
    max = drill.scaled_max;
  }

  const level = getLevelLabel(finalScore, drill.level_bands);
  const percent = max > 0 ? (finalScore / max) * 100 : 0;

  return {
    drill_id: drill.id,
    drill_name: drill.name,
    counts,
    raw_score: rawScore,
    final_score: finalScore,
    max_score: max,
    level,
    percent,
  };
}

export interface SessionSummary {
  total: number;
  maxTotal: number;
  level: string;
  best: DrillResult | null;
  weakest: DrillResult | null;
  mainMiss: string;
  recommendation: string;
}

export function summarizeSession(results: DrillResult[], drills: PuttingDrill[]): SessionSummary {
  const total = results.reduce((s, r) => s + r.final_score, 0);
  const maxTotal = results.reduce((s, r) => s + r.max_score, 0);
  const percentOf100 = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
  const level = getLevelLabel(percentOf100, SESSION_LEVELS);

  const sorted = [...results].sort((a, b) => b.percent - a.percent);
  const best = sorted[0] ?? null;
  const weakest = sorted[sorted.length - 1] ?? null;

  // Main miss: across all results, find the zero-point input with the highest count
  let mainMiss = '—';
  let topMissCount = 0;
  for (const r of results) {
    const drill = drills.find(d => d.id === r.drill_id);
    if (!drill) continue;
    for (const input of drill.scoring_inputs) {
      if (input.points === 0 && (r.counts[input.id] ?? 0) > topMissCount) {
        topMissCount = r.counts[input.id] ?? 0;
        mainMiss = `${input.label} (${drill.name})`;
      }
    }
  }

  const weakestDrill = weakest ? drills.find(d => d.id === weakest.drill_id) : null;
  const recommendation = weakestDrill?.recommendation ?? 'Keep practicing consistently.';

  return { total, maxTotal, level, best, weakest, mainMiss, recommendation };
}

export function validateDrillCounts(drill: PuttingDrill, counts: Record<string, number>): string | null {
  const total = drill.scoring_inputs.reduce((s, i) => s + (counts[i.id] ?? 0), 0);
  if (total !== drill.reps) {
    return `Total reps must equal ${drill.reps} (currently ${total}).`;
  }
  return null;
}
