// Shared helpers for computing per-shot consistency vs target bands.

import type { BestShotCondition, PracticeMetricTarget } from '@/types/practice';

export type ShotLike = { metrics: Record<string, unknown> };

export interface ShotConsistencyScores {
  distance: number | null;
  lateral: number | null;
  best: number | null;
  overall: number | null;
}

const LENGTH_MODE_CLUB_IDS = new Set(['dr', '5w', '4h', '5h']);
const DISTANCE_METRIC_IDS = new Set(['carry', 'total_distance']);

function practiceClubFromConfigKey(configKey?: string | null): string | null {
  return configKey?.split('_')[0] ?? null;
}

export function usesLengthModeDistanceMetric(metricId: string, configKey?: string | null): boolean {
  const club = practiceClubFromConfigKey(configKey);
  return DISTANCE_METRIC_IDS.has(metricId) && club !== null && LENGTH_MODE_CLUB_IDS.has(club);
}

export function getShotMetricValue(metricId: string, shot: ShotLike): number | null {
  const m = shot.metrics as Record<string, number | string | undefined>;
  const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : null);
  switch (metricId) {
    case 'carry': return num(m.carry);
    case 'total_distance': return num(m.total);
    case 'ball_speed': return num(m.ballSpeed);
    case 'peak_height': return num(m.height);
    case 'launch_angle': return num(m.launchAngle);
    case 'launch_direction': return num(m.launchDirection);
    case 'avg_lateral_miss': {
      const v = num(m.carrySide);
      return v === null ? null : Math.abs(v);
    }
    case 'attack_angle': return num(m.attackAngle);
    case 'swing_speed': return num(m.swingSpeed);
    case 'peak_hand_speed': return num(m.peakHandSpeed);
    case 'backswing_time': return num(m.backswingTime);
    case 'downswing_time': return num(m.downswingTime);
    case 'smash_factor': {
      const bs = num(m.ballSpeed); const ss = num(m.swingSpeed);
      return bs !== null && ss && ss > 0 ? bs / ss : null;
    }
    case 'tempo_ratio': {
      const t = m.tempo;
      if (typeof t === 'number') return t;
      if (typeof t === 'string') {
        const match = t.match(/^([\d.]+)\s*:\s*1$/);
        if (match) return parseFloat(match[1]);
        const n = parseFloat(t);
        return Number.isNaN(n) ? null : n;
      }
      return null;
    }
    default: return null;
  }
}

export function pctWithinTarget(
  metricId: string,
  shots: ShotLike[],
  targetMin: number | null,
  targetMax: number | null,
  configKey?: string | null,
): number | null {
  if (!shots || shots.length === 0) return null;
  if (targetMin === null && targetMax === null) return null;

  const lengthMode = usesLengthModeDistanceMetric(metricId, configKey);
  const floor = targetMin ?? targetMax;
  const lowerBound = lengthMode
    ? floor
    : targetMin === null ? -Infinity : targetMin;
  const upperBound = lengthMode
    ? Infinity
    : targetMax === null ? Infinity : targetMax;
  if (lowerBound === null || upperBound === null) return null;

  let considered = 0;
  let hits = 0;
  for (const shot of shots) {
    const v = getShotMetricValue(metricId, shot);
    if (v === null) continue;
    considered++;
    if (v >= lowerBound && v <= upperBound) hits++;
  }
  if (considered === 0) return null;
  return Math.round((hits / considered) * 100);
}

function isShotMetricInTarget(
  shot: ShotLike,
  condition: BestShotCondition,
  target: PracticeMetricTarget | undefined,
): boolean {
  const value = getShotMetricValue(condition.metricId, shot);
  if (value === null || !target || (target.targetMin === null && target.targetMax === null)) return false;

  if (condition.mode === 'min') {
    const min = target.targetMin ?? target.targetMax;
    return min !== null && value >= min;
  }

  if (condition.mode === 'max') {
    const max = target.targetMax ?? target.targetMin;
    return max !== null && value <= max;
  }

  const min = target.targetMin ?? target.targetMax!;
  const max = target.targetMax ?? target.targetMin!;
  return value >= Math.min(min, max) && value <= Math.max(min, max);
}

export function pctBestShots(
  shots: ShotLike[],
  targets: PracticeMetricTarget[],
  conditions: BestShotCondition[],
): number | null {
  if (shots.length === 0 || conditions.length === 0) return null;

  let considered = 0;
  let hits = 0;
  for (const shot of shots) {
    if (!conditions.every(condition => getShotMetricValue(condition.metricId, shot) !== null)) continue;

    considered++;
    if (conditions.every(condition => (
      isShotMetricInTarget(
        shot,
        condition,
        targets.find(metric => metric.id === condition.metricId),
      )
    ))) {
      hits++;
    }
  }

  return considered === 0 ? null : Math.round((hits / considered) * 100);
}

export function calculateShotConsistency(
  shots: ShotLike[],
  targets: PracticeMetricTarget[],
  bestShotConditions: BestShotCondition[],
  configKey?: string | null,
): ShotConsistencyScores {
  const distanceTarget = targets.find(metric => metric.id === 'total_distance');
  const lateralTarget = targets.find(metric => metric.id === 'avg_lateral_miss');
  const distance = pctWithinTarget(
    'total_distance',
    shots,
    distanceTarget?.targetMin ?? null,
    distanceTarget?.targetMax ?? null,
    configKey,
  );
  const lateral = pctWithinTarget(
    'avg_lateral_miss',
    shots,
    lateralTarget?.targetMin ?? null,
    lateralTarget?.targetMax ?? null,
    configKey,
  );
  const best = pctBestShots(shots, targets, bestShotConditions);
  const validCoreScores = [distance, lateral].filter((score): score is number => score !== null);
  const overall = validCoreScores.length === 0
    ? null
    : Math.round(validCoreScores.reduce((sum, score) => sum + score, 0) / validCoreScores.length);

  return { distance, lateral, best, overall };
}

// Recommended drills per metric weakness. Keep terse and actionable.
export const METRIC_DRILLS: Record<string, { focus: string; drills: string[] }> = {
  carry: {
    focus: 'Inconsistent carry distance — strike and speed control',
    drills: [
      'Step-change ladder: hit 3 shots each at 80%, 90%, 100% effort; check carry gap is < 8m between steps.',
      'Towel-under-arms drill to keep connection and centre strike.',
    ],
  },
  total_distance: {
    focus: 'Total distance scatter — roll/strike inconsistency',
    drills: [
      'Strike spray (foot powder) — 10 balls focused on centred contact.',
      'Stock-shot block: 10 balls at one fixed target distance, log total each shot.',
    ],
  },
  ball_speed: {
    focus: 'Ball speed below target — strike efficiency or clubhead speed',
    drills: [
      'Speed-stick overspeed protocol: 3 sets of 6 swings, light–heavy–light.',
      'Centre-face strike drill (foot spray) to lift smash factor.',
    ],
  },
  peak_height: {
    focus: 'Trajectory off target — launch & spin window',
    drills: [
      'Window drill: pick a notional 4m vertical window at peak height, 10 balls.',
      'Ball-position ladder: forward/middle/back, 3 shots each, log height.',
    ],
  },
  launch_angle: {
    focus: 'Launch outside target window',
    drills: [
      'Tee-height test: 3 heights × 3 balls, find launch sweet spot.',
      'Attack-angle drill: alligator (steeper) vs sweep (shallower) tee shots.',
    ],
  },
  launch_direction: {
    focus: 'Start line drifting — face control at impact',
    drills: [
      'Gate drill: two tees 6 inches in front of ball, must start ball through gate.',
      'Alignment-stick start-line drill, 10 balls to a 3° corridor.',
    ],
  },
  avg_lateral_miss: {
    focus: 'Lateral dispersion too high — face/path control',
    drills: [
      '9-shot matrix (low/mid/high × draw/straight/fade) to feel face vs path.',
      'Two-tee corridor drill: lateral lines on ground, must finish inside.',
    ],
  },
  bias_direction: {
    focus: 'Persistent shape bias — face-to-path mismatch',
    drills: [
      'Opposite-shape drill: hit 10 of the opposite shape on demand.',
      'Grip checkpoint: trail-hand position drill to neutralise face.',
    ],
  },
  attack_angle: {
    focus: 'Attack angle out of window — low point control',
    drills: [
      'Line drill: draw a chalk line, ball on line, divot must start in front.',
      'Punch-shot drill: belt-buckle through impact, 10 reps.',
    ],
  },
  swing_speed: {
    focus: 'Swing speed under target — generate more clubhead speed',
    drills: [
      'Overspeed training: 3×5 swings (light/normal/heavy) with speed sticks.',
      'Step-in drill: build sequencing from ground up.',
    ],
  },
  peak_hand_speed: {
    focus: 'Hand speed below target — sequencing / release',
    drills: [
      'Whoosh drill: turn club upside down, max whoosh near impact zone.',
      'Pump drill: pause at top, two pumps then release.',
    ],
  },
  smash_factor: {
    focus: 'Smash factor below target — centred strike',
    drills: [
      'Foot-spray strike drill: 10 balls, mark face contact each shot.',
      'Tee-gate drill: two tees just outside heel/toe, must avoid hitting.',
    ],
  },
  backswing_time: {
    focus: 'Backswing tempo off — rhythm',
    drills: [
      'Metronome drill (e.g. 76 bpm): 3 beats back, 1 down.',
      'Counted swings: aloud "one-two-three" back, "one" down, 10 reps.',
    ],
  },
  downswing_time: {
    focus: 'Downswing tempo off — sequencing',
    drills: [
      'Pause-at-top drill: 1-second pause, then full downswing, 10 reps.',
      'Step-down drill to load transition tempo correctly.',
    ],
  },
  tempo_ratio: {
    focus: 'Tempo ratio outside 2.8–3.2 — overall rhythm',
    drills: [
      'Metronome 3:1 drill — 10 swings counting back-swing/down-swing beats.',
      'Eyes-closed swings, 10 reps, feel the rhythm instead of seeing it.',
    ],
  },
};
