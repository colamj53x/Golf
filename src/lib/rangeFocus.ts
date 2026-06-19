import { pctWithinTarget, type ShotLike } from '@/lib/practiceConsistency';
import type { MetricStatus, PracticeMetricTarget } from '@/types/practice';

export type RangeReferenceSection = 'swing' | 'outcome';

export interface RangeReferenceRow {
  section: RangeReferenceSection;
  metricId: string;
  metricName: string;
  target: string;
  latest18Pct: number | null;
  status: MetricStatus | null;
  lowLabel: string;
  lowTip: string;
  highLabel: string;
  highTip: string;
}

const SWING_METRIC_IDS = [
  'tempo_ratio',
  'attack_angle',
  'launch_direction',
  'launch_angle',
  'peak_height',
  'ball_speed',
] as const;

const OUTCOME_METRIC_IDS = [
  'carry',
  'total_distance',
  'roll',
  'avg_lateral_miss',
] as const;

function statusForScore(score: number | null): MetricStatus | null {
  if (score === null) return null;
  if (score >= 80) return 'green';
  if (score >= 50) return 'amber';
  return 'red';
}

function formatTarget(metric: PracticeMetricTarget): string {
  if (!metric.targetDisplay || metric.targetDisplay === '–') return 'Reference only';
  return metric.unit ? `${metric.targetDisplay} ${metric.unit}` : metric.targetDisplay;
}

function tipsFor(metricId: string, configKey: string): Pick<RangeReferenceRow, 'lowLabel' | 'lowTip' | 'highLabel' | 'highTip'> {
  const isDriver = configKey.startsWith('dr_');

  switch (metricId) {
    case 'tempo_ratio':
      return {
        lowLabel: 'Below target',
        lowTip: 'Give the backswing time to finish before changing direction.',
        highLabel: 'Above target',
        highTip: 'Keep the backswing flowing; avoid a long pause or sudden hit from the top.',
      };
    case 'attack_angle':
      return isDriver
        ? {
            lowLabel: 'Too negative',
            lowTip: 'Ball forward, trail shoulder lower and feel the club sweep upward through the tee.',
            highLabel: 'Too positive',
            highTip: 'Reduce excess tilt, stay centred and let the club travel through—not sharply up.',
          }
        : {
            lowLabel: 'Too steep',
            lowTip: 'Check the ball is not too far back; stay centred and keep turning through.',
            highLabel: 'Too shallow',
            highTip: 'Pressure favouring the lead side; strike the ball before the turf.',
          };
    case 'launch_direction':
      return {
        lowLabel: 'Left of window',
        lowTip: 'Reset the face at your start spot first, then build the stance around it.',
        highLabel: 'Right of window',
        highTip: 'Reset the face at your start spot first; do not aim the body to rescue it.',
      };
    case 'launch_angle':
      return isDriver
        ? {
            lowLabel: 'Too low',
            lowTip: 'Check tee height and ball-forward position; keep the trail shoulder lower.',
            highLabel: 'Too high',
            highTip: 'Tee slightly lower, stay centred and avoid hanging back through impact.',
          }
        : {
            lowLabel: 'Too low',
            lowTip: 'Check the ball is not too far back and avoid excessive forward shaft lean.',
            highLabel: 'Too high',
            highTip: 'Keep pressure forward and turn through without scooping added loft.',
          };
    case 'peak_height':
      return {
        lowLabel: 'Too low',
        lowTip: 'Check strike and launch first; picture the ball passing through a higher window.',
        highLabel: 'Too high',
        highTip: 'Keep posture stable and flight it through a lower window without swinging harder.',
      };
    case 'ball_speed':
      return {
        lowLabel: 'Below target',
        lowTip: 'Prioritise centred contact and a balanced finish—do not simply add effort.',
        highLabel: 'Above target',
        highTip: 'Keep the same balance and rhythm; there is no need to chase more speed.',
      };
    case 'avg_lateral_miss':
      return {
        lowLabel: 'Inside limit',
        lowTip: 'Keep the same stock shape, start line and committed finish.',
        highLabel: 'Over limit',
        highTip: 'Return attention to face aim and start line before trying to change curve.',
      };
    case 'carry':
    case 'total_distance':
      return {
        lowLabel: 'Below target',
        lowTip: 'Check centred strike and delivery first; keep tempo instead of swinging harder.',
        highLabel: 'Above target',
        highTip: 'Keep rhythm and reduce swing length or effort slightly rather than steering it.',
      };
    case 'roll':
      return {
        lowLabel: 'Below target',
        lowTip: 'Check launch and landing window; do not force extra speed into the strike.',
        highLabel: 'Above target',
        highTip: 'Use a slightly higher landing window while keeping the same rhythm.',
      };
    default:
      return {
        lowLabel: 'Below target',
        lowTip: 'Return to the profile setup and make the same balanced stock swing.',
        highLabel: 'Above target',
        highTip: 'Keep the stock rhythm and change only one setup variable at a time.',
      };
  }
}

export function buildRangeReferenceRows(
  metrics: PracticeMetricTarget[],
  shots: ShotLike[],
  configKey: string,
): RangeReferenceRow[] {
  const latest18 = shots.slice(0, 18);

  const build = (metricId: string, section: RangeReferenceSection): RangeReferenceRow | null => {
    const metric = metrics.find(candidate => candidate.id === metricId);
    if (!metric) return null;
    const latest18Pct = pctWithinTarget(
      metric.id,
      latest18,
      metric.targetMin,
      metric.targetMax,
      configKey,
    );

    return {
      section,
      metricId: metric.id,
      metricName: metric.metricName,
      target: formatTarget(metric),
      latest18Pct,
      status: statusForScore(latest18Pct),
      ...tipsFor(metric.id, configKey),
    };
  };

  return [
    ...SWING_METRIC_IDS.map(metricId => build(metricId, 'swing')),
    ...OUTCOME_METRIC_IDS.map(metricId => build(metricId, 'outcome')),
  ].filter((row): row is RangeReferenceRow => row !== null);
}

export function getPrimaryRangeFocus(rows: RangeReferenceRow[]): RangeReferenceRow | null {
  const measurable = rows.filter(row => row.latest18Pct !== null);
  if (measurable.length === 0) return rows.find(row => row.section === 'swing') ?? rows[0] ?? null;

  const weakest = (items: RangeReferenceRow[]) => (
    [...items].sort((a, b) => (a.latest18Pct ?? 101) - (b.latest18Pct ?? 101))[0] ?? null
  );
  const swingNeedsWork = measurable.filter(row => row.section === 'swing' && (row.latest18Pct ?? 100) < 80);
  if (swingNeedsWork.length > 0) return weakest(swingNeedsWork);

  const outcomeNeedsWork = measurable.filter(row => row.section === 'outcome' && (row.latest18Pct ?? 100) < 80);
  if (outcomeNeedsWork.length > 0) return weakest(outcomeNeedsWork);

  return weakest(measurable);
}
