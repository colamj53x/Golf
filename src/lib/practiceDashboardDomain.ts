import { format } from 'date-fns';
import { getClubConfigId } from '@/lib/golfCalculations';
import { pctWithinTarget } from '@/lib/practiceConsistency';
import { getConfigDisplayName } from '@/types/practiceClubs';
import type { ClubPracticeConfig, MetricStatus, PracticeMetricValue, PracticeSession } from '@/types/practice';

export type TrendDirection = 'improving' | 'declining' | 'stable' | 'no-data';

export function calculateTrend(
  currentValue: PracticeMetricValue | null,
  previousValues: (PracticeMetricValue | null)[],
  higherIsBetter: boolean
): TrendDirection {
  if (!currentValue || (currentValue.valueMin === null && currentValue.valueMax === null)) {
    return 'no-data';
  }

  const currentAvg = currentValue.valueMax !== null && currentValue.valueMin !== null
    ? (currentValue.valueMax + currentValue.valueMin) / 2
    : currentValue.valueMax ?? currentValue.valueMin ?? 0;

  const validPrevious = previousValues.filter(v => v && (v.valueMin !== null || v.valueMax !== null));
  if (validPrevious.length === 0) return 'no-data';

  const prevAvg = validPrevious.reduce((sum, v) => {
    const avg = v!.valueMax !== null && v!.valueMin !== null
      ? (v!.valueMax + v!.valueMin) / 2
      : v!.valueMax ?? v!.valueMin ?? 0;
    return sum + avg;
  }, 0) / validPrevious.length;

  const diff = currentAvg - prevAvg;
  const threshold = Math.abs(prevAvg) * 0.05; // 5% threshold for "stable"

  if (Math.abs(diff) < threshold) return 'stable';

  if (higherIsBetter) {
    return diff > 0 ? 'improving' : 'declining';
  } else {
    return diff < 0 ? 'improving' : 'declining';
  }
}

export function calculateStatus(
  value: PracticeMetricValue | null,
  targetMin: number | null,
  targetMax: number | null,
  higherIsBetter: boolean,
  tolerancePct = 10,
): MetricStatus {
  // Handle legacy 'value' property from DB alongside valueMin/valueMax
  const rawValue = value as PracticeMetricValue & { value?: number };

  // Extract the actual numeric values, accounting for legacy 'value' field
  const legacyValue = rawValue?.value ?? null;
  const effectiveMin = value?.valueMin ?? legacyValue;
  const effectiveMax = value?.valueMax ?? legacyValue;

  if (!value || (effectiveMin === null && effectiveMax === null)) {
    return 'amber'; // No data
  }

  // For single-value metrics, use the single value; for ranges, use max for higherIsBetter, min for lowerIsBetter
  const actualValue = higherIsBetter
    ? (effectiveMax ?? effectiveMin ?? 0)
    : (effectiveMin ?? effectiveMax ?? 0);

  const hasRange = effectiveMin !== null && effectiveMax !== null && effectiveMin !== effectiveMax;

  if (targetMin === null && targetMax === null) {
    return 'amber'; // No target set
  }

  // Check consistency: if user entered a range, compare spread to target spread
  let consistencyPenalty: MetricStatus | null = null;
  if (hasRange && targetMin !== null && targetMax !== null) {
    const userSpread = Math.abs(effectiveMax! - effectiveMin!);
    const targetSpread = Math.abs(targetMax - targetMin);

    // If user's range is significantly wider than target range, penalize
    if (targetSpread > 0) {
      const spreadRatio = userSpread / targetSpread;
      if (spreadRatio >= 2.0) {
        consistencyPenalty = 'red'; // Range is 2x+ wider than target
      } else if (spreadRatio > 1.0) {
        consistencyPenalty = 'amber'; // Range exceeds target spread
      }
    } else {
      // Target is a single value, any range is inconsistent
      const midpoint = (effectiveMin! + effectiveMax!) / 2;
      const spreadPct = (userSpread / midpoint) * 100;
      if (spreadPct > tolerancePct * 1.5) {
        consistencyPenalty = 'red';
      } else if (spreadPct > tolerancePct) {
        consistencyPenalty = 'amber';
      }
    }
  }

  // Calculate value status based on target alignment
  let valueStatus: MetricStatus = 'green';

  // For higherIsBetter: above max = excellent (green), below min = bad
  if (higherIsBetter) {
    if (targetMax !== null && actualValue > targetMax) {
      valueStatus = 'green'; // Exceeding target is great
    } else if (targetMin !== null && actualValue >= targetMin && (targetMax === null || actualValue <= targetMax)) {
      valueStatus = 'green'; // Within range
    } else if (targetMin !== null && actualValue < targetMin) {
      // Below minimum is bad
      const deviationPct = (targetMin - actualValue) / targetMin;
      if (deviationPct >= (tolerancePct / 100) * 2) valueStatus = 'red';
      else if (deviationPct >= tolerancePct / 100) valueStatus = 'amber';
      else valueStatus = 'green'; // Very close
    } else {
      valueStatus = 'amber';
    }
  } else {
    // For lowerIsBetter: below max = good, above max = bad
    // Check if there's only a max target (like ≤10)
    if (targetMax !== null && actualValue <= targetMax) {
      valueStatus = 'green'; // Within or below max
    } else if (targetMax !== null && actualValue > targetMax) {
      // Above maximum is bad for lowerIsBetter
      const deviationPct = (actualValue - targetMax) / targetMax;
      if (deviationPct >= (tolerancePct / 100) * 2) valueStatus = 'red';
      else if (deviationPct >= tolerancePct / 100) valueStatus = 'amber';
      else valueStatus = 'green'; // Very close (under 20%)
    } else if (targetMin !== null && actualValue < targetMin) {
      // Below minimum for lowerIsBetter could be too low
      valueStatus = 'amber';
    } else {
      valueStatus = 'amber';
    }
  }

  // Return worst of value status and consistency penalty
  if (consistencyPenalty === 'red' || valueStatus === 'red') return 'red';
  if (consistencyPenalty === 'amber' || valueStatus === 'amber') return 'amber';
  return 'green';
}

export function getMetricTolerancePct(
  category: string,
  distanceTolerancePct: number,
  ballFlightTolerancePct: number,
  otherTolerancePct: number,
): number {
  if (category === 'distance') return distanceTolerancePct;
  if (category === 'ball_flight') return ballFlightTolerancePct;
  return otherTolerancePct;
}

// Helper to extract numeric value from metric (handles legacy 'value' field)
export const getMetricValues = (metric: PracticeMetricValue | undefined): { min: number | null; max: number | null } => {
  if (!metric) return { min: null, max: null };
  const rawMetric = metric as PracticeMetricValue & { value?: number };
  const legacyValue = rawMetric.value ?? null;
  return {
    min: metric.valueMin ?? legacyValue,
    max: metric.valueMax ?? legacyValue,
  };
};

// Parse user input like "123", "120–125", "120-125" into numbers
export const parseInputValue = (valueStr: string): { min: number | null; max: number | null } => {
  const raw = (valueStr || '').trim();
  if (!raw) return { min: null, max: null };

  // Support either en-dash or hyphen
  if (raw.includes('–') || raw.includes('-')) {
    const parts = raw.split(/[–-]/).map(s => parseFloat(s.trim()));
    const min = isNaN(parts[0]) ? null : parts[0];
    const max = isNaN(parts[1]) ? null : parts[1];
    return { min, max };
  }

  const val = parseFloat(raw);
  if (isNaN(val)) return { min: null, max: null };
  return { min: val, max: val };
};

const avgFromMinMax = (v: { min: number | null; max: number | null }) => {
  if (v.min === null && v.max === null) return null;
  if (v.min !== null && v.max !== null) return (v.min + v.max) / 2;
  return v.max ?? v.min;
};

export const computeSmashFactorMetricFromMetrics = (metrics: PracticeMetricValue[]): PracticeMetricValue | null => {
  const ball = metrics.find(m => m.metricId === 'ball_speed');
  const swing = metrics.find(m => m.metricId === 'swing_speed');

  const ballAvg = avgFromMinMax(getMetricValues(ball));
  const swingAvg = avgFromMinMax(getMetricValues(swing));

  if (ballAvg === null || swingAvg === null || swingAvg <= 0) return null;

  const smash = Math.round((ballAvg / swingAvg) * 100) / 100;
  return {
    metricId: 'smash_factor',
    valueMin: smash,
    valueMax: smash,
    valueDisplay: smash.toFixed(2),
  };
};

export const computeSmashFactorDisplayFromInputs = (metricsMap: Record<string, string>) => {
  const ballAvg = avgFromMinMax(parseInputValue(metricsMap['ball_speed'] || ''));
  const swingAvg = avgFromMinMax(parseInputValue(metricsMap['swing_speed'] || ''));
  if (ballAvg === null || swingAvg === null || swingAvg <= 0) return '–';
  return (Math.round((ballAvg / swingAvg) * 100) / 100).toFixed(2);
};

export const getSessionMetricValue = (session: PracticeSession | null, metricId: string): PracticeMetricValue | null => {
  if (!session) return null;

  const stored = session.metrics.find(m => m.metricId === metricId) || null;

  if (metricId !== 'smash_factor') return stored;

  // If Smash Factor isn't stored (or is blank), compute it from ball_speed / swing_speed
  if (stored && (stored.valueMin !== null || stored.valueMax !== null || (stored.valueDisplay || '').trim())) {
    return stored;
  }

  return computeSmashFactorMetricFromMetrics(session.metrics);
};

// Structured report for the latest session of the current club.
// Returns a tight headline + a few sharp bullets. No fluff.
export type PracticeReportBullet = {
  label: string;
  text: string;
  tone: 'positive' | 'negative' | 'neutral';
};
export type PracticeReport = {
  title: string;
  headline: string;
  tone: 'positive' | 'negative' | 'neutral';
  bullets: PracticeReportBullet[];
};

export function buildClubPracticeReport(
  config: ClubPracticeConfig | undefined,
  currentSession: PracticeSession | null,
  previousSession: PracticeSession | null,
  allSessions: PracticeSession[],
  shotsBySession: Record<string, Array<{ metrics: Record<string, unknown>; excluded: boolean }>>,
  configKey: string,
  courseShots: Array<{ club: string; date: Date; endLie: string }>,
  distanceTolerancePct: number,
  ballFlightTolerancePct: number,
  otherTolerancePct: number,
): PracticeReport {
  const clubName = (() => {
    try { return getConfigDisplayName(configKey); } catch { return configKey; }
  })();

  if (!config || !currentSession) {
    return {
      title: clubName,
      headline: 'No session logged yet for this club.',
      tone: 'neutral',
      bullets: [{ label: 'Next step', text: 'Upload or add a session to start tracking carry, dispersion and consistency.', tone: 'neutral' }],
    };
  }

  const getVal = (session: PracticeSession | null, id: string): PracticeMetricValue | null => {
    if (!session) return null;
    return session.metrics.find(m => m.metricId === id) ?? null;
  };

  const currentShots = (shotsBySession[currentSession.id] ?? []) as unknown as Array<{ metrics: Record<string, unknown> }>;
  const prevSessions = allSessions.filter(s => s.id !== currentSession.id);
  const prev2 = prevSessions.slice(0, 2);
  const [baseClub] = configKey.split('_');
  const matchingCourseShots = courseShots.filter(shot => getClubConfigId(shot.club) === baseClub);
  const roundCount = new Set(courseShots.map(shot => format(shot.date, 'yyyy-MM-dd'))).size;
  const coursePerRound = roundCount ? matchingCourseShots.length / roundCount : 0;
  const safeCourseShots = matchingCourseShots.filter(shot => {
    const lie = shot.endLie.toLowerCase();
    return lie.includes('fairway') || lie.includes('green') || lie.includes('fringe') || lie.includes('hole');
  }).length;
  const dependability = matchingCourseShots.length ? Math.round((safeCourseShots / matchingCourseShots.length) * 100) : null;

  type MetricLine = {
    name: string;
    current: number;
    prev2Avg: number | null;
    histBest: number | null;
    histCount: number;
    delta2: number | null;
    status: MetricStatus;
  };

  const lines: MetricLine[] = [];
  for (const metric of config.metrics) {
    const v = getVal(currentSession, metric.id);
    const tolerancePct = getMetricTolerancePct(metric.category, distanceTolerancePct, ballFlightTolerancePct, otherTolerancePct);
    const status = v ? calculateStatus(v, metric.targetMin, metric.targetMax, metric.higherIsBetter, tolerancePct) : 'amber';
    const cur = pctWithinTarget(metric.id, currentShots, metric.targetMin, metric.targetMax, tolerancePct);
    if (cur === null) continue;

    const prev2Vals = prev2
      .map(s => pctWithinTarget(metric.id, (shotsBySession[s.id] ?? []) as unknown as Array<{ metrics: Record<string, unknown> }>, metric.targetMin, metric.targetMax, tolerancePct))
      .filter((x): x is number => x !== null);
    const prev2Avg = prev2Vals.length ? prev2Vals.reduce((a, b) => a + b, 0) / prev2Vals.length : null;

    const histVals = prevSessions
      .map(s => pctWithinTarget(metric.id, (shotsBySession[s.id] ?? []) as unknown as Array<{ metrics: Record<string, unknown> }>, metric.targetMin, metric.targetMax, tolerancePct))
      .filter((x): x is number => x !== null);
    const histBest = histVals.length ? Math.max(...histVals) : null;

    lines.push({
      name: metric.metricName,
      current: cur,
      prev2Avg,
      histBest,
      histCount: histVals.length,
      delta2: prev2Avg !== null ? cur - prev2Avg : null,
      status,
    });
  }

  const avgWithin = lines.length
    ? Math.round(lines.reduce((s, l) => s + l.current, 0) / lines.length)
    : null;

  let headline: string;
  let tone: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (avgWithin === null) {
    let green = 0, amber = 0, red = 0;
    for (const metric of config.metrics) {
      const v = getVal(currentSession, metric.id);
      if (!v) continue;
      const tolerancePct = getMetricTolerancePct(metric.category, distanceTolerancePct, ballFlightTolerancePct, otherTolerancePct);
      const status = calculateStatus(v, metric.targetMin, metric.targetMax, metric.higherIsBetter, tolerancePct);
      if (status === 'green') green++;
      else if (status === 'amber') amber++;
      else if (status === 'red') red++;
    }
    const scored = green + amber + red;
    if (scored === 0) {
      headline = 'No values logged for this session yet.';
    } else {
      headline = `${green} green · ${amber} amber · ${red} red across ${scored} metrics (no per-shot data — consistency % unavailable).`;
      tone = red > green ? 'negative' : green > red ? 'positive' : 'neutral';
    }
  } else if (avgWithin >= 70) {
    headline = `Solid session for ${clubName} — across the metrics tracked, ${avgWithin}% of your shots landed inside their target windows, which is a strong base to build on.`;
    tone = 'positive';
  } else if (avgWithin >= 45) {
    headline = `Mixed session for ${clubName} — about ${avgWithin}% of your shots fell inside their target windows, so there were good patches but also clear gaps to tighten up.`;
    tone = 'neutral';
  } else {
    headline = `Poor session for ${clubName} — only ${avgWithin}% of your shots stayed inside their target windows, which means most numbers drifted outside where you want them.`;
    tone = 'negative';
  }

  const improved = lines.filter(l => l.delta2 !== null && l.delta2 >= 5)
    .sort((a, b) => (b.delta2 ?? 0) - (a.delta2 ?? 0)).slice(0, 2);
  const slipped = lines.filter(l => l.delta2 !== null && l.delta2 <= -5)
    .sort((a, b) => (a.delta2 ?? 0) - (b.delta2 ?? 0)).slice(0, 2);
  const focus = lines.filter(l => l.status !== 'green' && l.current < 50)
    .sort((a, b) => a.current - b.current).slice(0, 2);
  const personalBests = lines.filter(l => l.histCount >= 1 && l.histBest !== null && l.current > (l.histBest as number))
    .sort((a, b) => b.current - a.current).slice(0, 2);
  const strongest = lines.filter(l => l.current >= 70)
    .sort((a, b) => b.current - a.current).slice(0, 2);

  const bullets: PracticeReportBullet[] = [];
  const list = (arr: MetricLine[], fn: (l: MetricLine) => string) =>
    arr.map(fn).join(arr.length === 2 ? ' and ' : ', ');

  if (matchingCourseShots.length) {
    bullets.push({
      label: 'Course use',
      text: `${clubName} shows up about ${coursePerRound.toFixed(1)} time${coursePerRound === 1 ? '' : 's'} per round across ${matchingCourseShots.length} on-course shots, so this practice has ${coursePerRound >= 1 ? 'high' : coursePerRound >= 0.4 ? 'medium' : 'lower'} playing relevance.`,
      tone: coursePerRound >= 1 ? 'negative' : 'neutral',
    });
    bullets.push({
      label: 'Dependability',
      text: dependability === null
        ? 'There is not enough on-course outcome data to judge dependability yet.'
        : `${dependability}% of on-course shots finished in a playable result, so use the practice metrics alongside that real-course reliability.`,
      tone: dependability !== null && dependability >= 65 ? 'positive' : dependability !== null && dependability < 45 ? 'negative' : 'neutral',
    });
  }

  if (improved.length) {
    bullets.push({
      label: 'Improved',
      text: `You moved forward on ${list(improved, l => `${l.name} (up ${Math.round(l.delta2 as number)}pp to ${l.current}% in target)`)} compared with your last couple of sessions, so whatever you changed there is working.`,
      tone: 'positive',
    });
  } else if (strongest.length) {
    bullets.push({
      label: 'Strengths',
      text: `Your strongest numbers this session were ${list(strongest, l => `${l.name} at ${l.current}% in target`)}, which is where this club is currently most reliable.`,
      tone: 'positive',
    });
  }

  if (personalBests.length) {
    bullets.push({
      label: 'Personal best',
      text: `You set a new personal best for ${list(personalBests, l => `${l.name} at ${l.current}% in target`)} — the highest you've recorded for this club, so lock in whatever you did today.`,
      tone: 'positive',
    });
  }

  const priority = focus[0] ?? slipped[0] ?? null;
  if (priority) {
    const dropTxt = priority.delta2 !== null && priority.delta2 < 0
      ? `, which is down ${Math.abs(Math.round(priority.delta2))}pp on your recent average`
      : '';
    bullets.push({
      label: 'Focus next',
      text: `Your weakest area was ${priority.name} at just ${priority.current}% of shots inside the target window${dropTxt}, so make that the priority next time out.`,
      tone: 'negative',
    });
    const second = focus[1] ?? slipped[1];
    if (second && second !== priority) {
      const sd = second.delta2 !== null && second.delta2 < 0
        ? `, also down ${Math.abs(Math.round(second.delta2))}pp on recent form`
        : '';
      bullets.push({
        label: 'Also watch',
        text: `Keep an eye on ${second.name} too — only ${second.current}% landed inside target${sd}, so it needs attention before it becomes a real problem.`,
        tone: 'negative',
      });
    }
  } else if (avgWithin !== null && avgWithin >= 70) {
    bullets.push({ label: 'Action', text: 'There is nothing obvious to fix in this session — keep the same routine, tempo and setup and bank another one just like it.', tone: 'positive' });
  }

  if (!previousSession && avgWithin !== null) {
    bullets.push({ label: 'Baseline', text: 'This is the first logged session for this club, so treat the numbers above as your baseline — every future session will be measured against today.', tone: 'neutral' });
  }

  return { title: clubName, headline, tone, bullets };
}
