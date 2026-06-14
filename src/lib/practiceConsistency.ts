// Shared helpers for computing per-shot consistency vs target bands.

export type ShotLike = { metrics: Record<string, unknown> };

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
  tolerancePct = 5,
): number | null {
  if (!shots || shots.length === 0) return null;
  if (targetMin === null && targetMax === null) return null;

  if (metricId === 'carry_variation' || metricId === 'total_variation') {
    const band = Math.max(Math.abs(targetMin ?? 0), Math.abs(targetMax ?? 0));
    if (!band || band <= 0) return null;
    const underlyingId = metricId === 'carry_variation' ? 'carry' : 'total_distance';
    const vals: number[] = [];
    for (const s of shots) {
      const v = getShotMetricValue(underlyingId, s);
      if (v !== null) vals.push(v);
    }
    if (vals.length === 0) return null;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const half = band / 2;
    const hits = vals.filter(v => Math.abs(v - mean) <= half).length;
    return Math.round((hits / vals.length) * 100);
  }

  const reference = Math.max(Math.abs(targetMin ?? 0), Math.abs(targetMax ?? 0), 1);
  const tol = reference * (tolerancePct / 100);
  const lo = targetMin === null ? -Infinity : targetMin - tol;
  const hi = targetMax === null ? Infinity : targetMax + tol;
  const lowerBound = Math.min(lo, hi);
  const upperBound = Math.max(lo, hi);

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
  carry_variation: {
    focus: 'Carry spread too wide — strike quality',
    drills: [
      'Coin / tee-gate strike drill: 15 balls, ball must be flushed cleanly.',
      'Half-swing pump drill to groove a repeatable low-point.',
    ],
  },
  total_variation: {
    focus: 'Total distance spread too wide — roll out & strike',
    drills: [
      'Pick a 5m landing window; 10 balls, count how many land inside.',
      'Smash-factor focus: 10 balls aiming for centred contact, log ball/swing speed.',
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
