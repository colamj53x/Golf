import { useEffect, useMemo, useState } from 'react';
import { Copy, Printer, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePracticeData } from '@/context/PracticeDataContext';
import { usePracticeShotsBySessions } from '@/hooks/usePracticeShotsBySessions';
import { useShotProfiles } from '@/lib/shotProfiles';
import { getEnabledShotFamilyOptions, getEnabledSwingEffortOptions } from '@/lib/shotOptions';
import { parseDirectionalNumber, formatDirectionTargetValue } from '@/lib/practiceDashboardDomain';
import { ClubPracticeConfig, PracticeMetricTarget } from '@/types/practice';
import { POWER_OPTIONS, PRACTICE_CLUBS, SHOT_TYPES, parsePracticeConfigKey } from '@/types/practiceClubs';

const CATEGORY_LABELS: Record<PracticeMetricTarget['category'], string> = {
  distance: 'Distance',
  ball_flight: 'Ball Flight',
  dispersion: 'Dispersion',
  swing: 'Swing',
  tempo: 'Tempo',
};

const CATEGORY_ORDER: PracticeMetricTarget['category'][] = ['distance', 'ball_flight', 'dispersion', 'swing', 'tempo'];
const NON_TARGET_METRIC_IDS = new Set(['furthest_total', 'shortest_total', 'carry_variation', 'total_variation', 'bias_direction']);
const MAX_ONLY_TARGET_METRIC_IDS = new Set(['avg_lateral_miss']);

type TargetDraft = Record<string, Record<string, { min: string; max: string }>>;

function formatTargetEditValue(metricId: string, value: number | null): string {
  if (value === null) return '';
  return metricId === 'launch_direction' ? formatDirectionTargetValue(value) : String(value);
}

function formatTargetDisplay(metricId: string, min: number | null, max: number | null): string {
  const formatValue = (value: number) => metricId === 'launch_direction'
    ? formatDirectionTargetValue(value)
    : String(value);

  if (MAX_ONLY_TARGET_METRIC_IDS.has(metricId)) {
    return max !== null ? `<=${formatValue(max)}` : '-';
  }
  if (min !== null && max !== null) return `${formatValue(min)}-${formatValue(max)}`;
  if (min !== null) return `>=${formatValue(min)}`;
  if (max !== null) return `<=${formatValue(max)}`;
  return '-';
}

function targetDraftFromConfigs(configs: ClubPracticeConfig[]): TargetDraft {
  return Object.fromEntries(configs.map((config) => [
    config.clubId,
    Object.fromEntries(config.metrics.map((metric) => [
      metric.id,
      {
        min: formatTargetEditValue(metric.id, metric.targetMin),
        max: formatTargetEditValue(metric.id, metric.targetMax),
      },
    ])),
  ]));
}

function getShotMetricRange(
  metricId: string,
  shots: Array<{ metrics: Record<string, unknown> }> | undefined,
): { min: number | null; max: number | null } {
  const metricKey: Record<string, string> = {
    total_distance: 'total',
    peak_height: 'height',
    avg_lateral_miss: 'carrySide',
  };
  const key = metricKey[metricId] ?? metricId;
  const values = (shots ?? [])
    .map((shot) => {
      const value = shot.metrics[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return metricId === 'avg_lateral_miss' ? Math.abs(value) : value;
      }
      return null;
    })
    .filter((value): value is number => value !== null);

  if (values.length === 0) return { min: null, max: null };
  if (metricId === 'avg_lateral_miss') {
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    return { min: null, max: Number(avg.toFixed(1)) };
  }
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function metricAverage(min: number | null, max: number | null): number | null {
  if (min !== null && max !== null) return (min + max) / 2;
  return min ?? max;
}

function latestMetricRange(
  configKey: string,
  metric: PracticeMetricTarget,
  sessions: ReturnType<typeof usePracticeData>['practiceSessions'],
  shotsBySession: ReturnType<typeof usePracticeShotsBySessions>['shotsBySession'],
): { min: number | null; max: number | null } {
  const { club: baseClub } = parsePracticeConfigKey(configKey);
  const latestSession = sessions
    .filter(session => session.clubId === configKey || session.clubId === baseClub)
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  if (!latestSession) return { min: null, max: null };

  const shotMetricRange = getShotMetricRange(metric.id, shotsBySession[latestSession.id] as unknown as Array<{ metrics: Record<string, unknown> }>);
  const sessionMetric = latestSession.metrics.find(item => item.metricId === metric.id);
  return {
    min: sessionMetric?.valueMin ?? shotMetricRange.min,
    max: sessionMetric?.valueMax ?? shotMetricRange.max,
  };
}

function parseTargetValue(metricId: string, value: string): number | null {
  if (!value.trim()) return null;
  return parseDirectionalNumber(value);
}

function buildUpdatedMetrics(config: ClubPracticeConfig, values: Record<string, { min: string; max: string }>): PracticeMetricTarget[] {
  const ballSpeedMin = parseTargetValue('ball_speed', values.ball_speed?.min ?? '');
  const ballSpeedMax = parseTargetValue('ball_speed', values.ball_speed?.max ?? '');
  const swingSpeedMin = parseTargetValue('swing_speed', values.swing_speed?.min ?? '');
  const swingSpeedMax = parseTargetValue('swing_speed', values.swing_speed?.max ?? '');

  return config.metrics.map((metric) => {
    if (NON_TARGET_METRIC_IDS.has(metric.id)) {
      return {
        ...metric,
        targetMin: null,
        targetMax: null,
        targetDisplay: '-',
      };
    }

    if (metric.id === 'smash_factor') {
      const targetMin = ballSpeedMin !== null && swingSpeedMax !== null && swingSpeedMax > 0
        ? Number((ballSpeedMin / swingSpeedMax).toFixed(2))
        : null;
      const targetMax = ballSpeedMax !== null && swingSpeedMin !== null && swingSpeedMin > 0
        ? Number((ballSpeedMax / swingSpeedMin).toFixed(2))
        : null;
      return {
        ...metric,
        targetMin,
        targetMax,
        targetDisplay: formatTargetDisplay(metric.id, targetMin, targetMax),
      };
    }

    const target = values[metric.id];
    const parsedMin = parseTargetValue(metric.id, target?.min ?? '');
    const parsedMax = parseTargetValue(metric.id, target?.max ?? '');
    const targetMin = MAX_ONLY_TARGET_METRIC_IDS.has(metric.id)
      ? null
      : parsedMin !== null && parsedMax !== null ? Math.min(parsedMin, parsedMax) : parsedMin;
    const targetMax = MAX_ONLY_TARGET_METRIC_IDS.has(metric.id)
      ? parsedMax
      : parsedMin !== null && parsedMax !== null ? Math.max(parsedMin, parsedMax) : parsedMax;
    return {
      ...metric,
      targetMin,
      targetMax,
      targetDisplay: formatTargetDisplay(metric.id, targetMin, targetMax),
    };
  });
}

function configSortKey(config: ClubPracticeConfig): [number, number, number] {
  const { club, shotType, power } = parsePracticeConfigKey(config.clubId);
  return [
    PRACTICE_CLUBS.findIndex(item => item.id === club),
    SHOT_TYPES.findIndex(item => item.id === shotType),
    POWER_OPTIONS.findIndex(item => item.id === power),
  ];
}

function compareConfig(a: ClubPracticeConfig, b: ClubPracticeConfig): number {
  const ak = configSortKey(a);
  const bk = configSortKey(b);
  return ak[0] - bk[0] || ak[1] - bk[1] || ak[2] - bk[2];
}

function shortConfigLabel(configKey: string): { club: string; shot: string; power: string } {
  const { club, shotType, power } = parsePracticeConfigKey(configKey);
  return {
    club: PRACTICE_CLUBS.find(item => item.id === club)?.name ?? club,
    shot: SHOT_TYPES.find(item => item.id === shotType)?.name ?? shotType,
    power: POWER_OPTIONS.find(item => item.id === power)?.name ?? power,
  };
}

export function PracticeTargetsMatrixTab() {
  const { practiceConfigs, practiceSessions, updatePracticeConfig } = usePracticeData();
  const profiles = useShotProfiles();
  const practiceSessionIds = useMemo(() => practiceSessions.map(session => session.id), [practiceSessions]);
  const { shotsBySession } = usePracticeShotsBySessions(practiceSessionIds);
  const [visibleCategories, setVisibleCategories] = useState<Record<PracticeMetricTarget['category'], boolean>>({
    distance: true,
    ball_flight: false,
    dispersion: false,
    swing: false,
    tempo: false,
  });
  const [draft, setDraft] = useState<TargetDraft>(() => targetDraftFromConfigs(practiceConfigs));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(targetDraftFromConfigs(practiceConfigs));
  }, [practiceConfigs]);

  const enabledConfigs = useMemo(() => (
    practiceConfigs
      .filter((config) => {
        const { club, shotType, power } = parsePracticeConfigKey(config.clubId);
        const families = getEnabledShotFamilyOptions(profiles, club, 'practice');
        const efforts = getEnabledSwingEffortOptions(profiles, club, shotType, 'practice');
        return families.some(option => option.value === shotType) && efforts.some(option => option.value === power);
      })
      .sort(compareConfig)
  ), [practiceConfigs, profiles]);

  const metricColumns = useMemo(() => {
    const byId = new Map<string, PracticeMetricTarget>();
    for (const config of practiceConfigs) {
      for (const metric of config.metrics) {
        if (!NON_TARGET_METRIC_IDS.has(metric.id) && !byId.has(metric.id)) byId.set(metric.id, metric);
      }
    }
    return [...byId.values()].filter(metric => visibleCategories[metric.category]);
  }, [practiceConfigs, visibleCategories]);

  const setCell = (configKey: string, metricId: string, side: 'min' | 'max', value: string) => {
    setDraft(prev => ({
      ...prev,
      [configKey]: {
        ...prev[configKey],
        [metricId]: {
          ...(prev[configKey]?.[metricId] ?? { min: '', max: '' }),
          [side]: value,
        },
      },
    }));
  };

  const copyLatestMetric = (config: ClubPracticeConfig, metric: PracticeMetricTarget) => {
    const range = latestMetricRange(config.clubId, metric, practiceSessions, shotsBySession);
    if (range.min === null && range.max === null) return;
    const avg = metricAverage(range.min, range.max);
    setDraft(prev => ({
      ...prev,
      [config.clubId]: {
        ...prev[config.clubId],
        [metric.id]: {
          min: MAX_ONLY_TARGET_METRIC_IDS.has(metric.id) ? '' : formatTargetEditValue(metric.id, range.min ?? avg),
          max: formatTargetEditValue(metric.id, range.max ?? avg),
        },
      },
    }));
  };

  const copyLatestForRow = (config: ClubPracticeConfig) => {
    for (const metric of metricColumns) {
      if (metric.id === 'smash_factor') continue;
      copyLatestMetric(config, metric);
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const config of enabledConfigs) {
        const updatedMetrics = buildUpdatedMetrics(config, draft[config.clubId] ?? {});
        const success = await updatePracticeConfig(config.clubId, updatedMetrics, config.bestShotDefinition);
        if (!success) throw new Error(`Could not save ${config.clubName}`);
      }
      toast.success('Practice target matrix saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save practice targets');
    } finally {
      setSaving(false);
    }
  };

  const printMatrix = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Practice Targets Matrix</CardTitle>
          <CardDescription>
            Edit target ranges across every enabled club and shot. Use category toggles to keep the table workable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {CATEGORY_ORDER.map(category => (
              <label key={category} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Checkbox
                  checked={visibleCategories[category]}
                  onCheckedChange={(checked) => setVisibleCategories(prev => ({ ...prev, [category]: checked === true }))}
                />
                {CATEGORY_LABELS[category]}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void saveAll()} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Matrix'}
            </Button>
            <Button variant="outline" onClick={printMatrix} className="gap-2">
              <Printer className="h-4 w-4" />
              Print / PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="print:pb-2">
          <CardTitle>Target Table</CardTitle>
          <CardDescription className="print:hidden">
            Each metric shows the target inputs it needs. The copy button uses the latest logged practice value for that row.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr className="bg-muted/80 text-muted-foreground">
                  <th className="sticky left-0 top-0 z-30 w-28 min-w-28 border-b bg-muted px-2 py-2 text-left">Club</th>
                  <th className="sticky left-28 top-0 z-30 w-24 min-w-24 border-b bg-muted px-2 py-2 text-left">Shot</th>
                  <th className="sticky left-52 top-0 z-30 w-20 min-w-20 border-b bg-muted px-2 py-2 text-left">Power</th>
                  <th className="sticky left-72 top-0 z-30 w-14 min-w-14 border-b bg-muted px-1.5 py-2 text-left print:hidden">Latest</th>
                  {metricColumns.map(metric => (
                    <th key={metric.id} className="sticky top-0 z-20 w-32 min-w-32 border-b bg-muted px-2 py-2 text-left">
                      <div className="font-semibold leading-tight text-foreground">{metric.metricName}</div>
                      <div className="text-[10px] leading-tight">{CATEGORY_LABELS[metric.category]}{metric.unit ? ` · ${metric.unit}` : ''}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enabledConfigs.map((config) => {
                  const labels = shortConfigLabel(config.clubId);
                  return (
                    <tr key={config.clubId} className="group hover:bg-muted/40">
                      <td className="sticky left-0 z-10 border-b bg-background px-2 py-1.5 font-medium group-hover:bg-muted/40">{labels.club}</td>
                      <td className="sticky left-28 z-10 border-b bg-background px-2 py-1.5 group-hover:bg-muted/40">{labels.shot}</td>
                      <td className="sticky left-52 z-10 border-b bg-background px-2 py-1.5 group-hover:bg-muted/40">{labels.power}</td>
                      <td className="sticky left-72 z-10 border-b bg-background px-1.5 py-1.5 group-hover:bg-muted/40 print:hidden">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Use latest logged values for this row" onClick={() => copyLatestForRow(config)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                      {metricColumns.map((metric) => {
                        const rowDraft = draft[config.clubId]?.[metric.id] ?? { min: '', max: '' };
                        const latest = latestMetricRange(config.clubId, metric, practiceSessions, shotsBySession);
                        const hasLatest = latest.min !== null || latest.max !== null;
                        const isSmashFactor = metric.id === 'smash_factor';
                        const isMaxOnlyMetric = MAX_ONLY_TARGET_METRIC_IDS.has(metric.id);
                        return (
                          <td key={metric.id} className="border-b px-1.5 py-1.5 align-top">
                            <div className={isMaxOnlyMetric ? 'grid grid-cols-[92px_24px] gap-1' : 'grid grid-cols-[44px_44px_24px] gap-1'}>
                              {!isMaxOnlyMetric && (
                                <>
                                  <Label className="sr-only" htmlFor={`${config.clubId}-${metric.id}-min`}>{metric.metricName} min</Label>
                                  <Input
                                    id={`${config.clubId}-${metric.id}-min`}
                                    value={rowDraft.min}
                                    onChange={(event) => setCell(config.clubId, metric.id, 'min', event.target.value)}
                                    placeholder="Min"
                                    disabled={isSmashFactor}
                                    className="h-7 px-1.5 text-center text-xs tabular-nums"
                                  />
                                </>
                              )}
                              <Label className="sr-only" htmlFor={`${config.clubId}-${metric.id}-max`}>{metric.metricName} max</Label>
                              <Input
                                id={`${config.clubId}-${metric.id}-max`}
                                value={rowDraft.max}
                                onChange={(event) => {
                                  if (isMaxOnlyMetric) setCell(config.clubId, metric.id, 'min', '');
                                  setCell(config.clubId, metric.id, 'max', event.target.value);
                                }}
                                placeholder="Max"
                                disabled={isSmashFactor}
                                className="h-7 px-1.5 text-center text-xs tabular-nums"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-6 print:hidden"
                                disabled={!hasLatest || isSmashFactor}
                                title={isSmashFactor ? 'Auto-calculated from ball speed and swing speed' : hasLatest ? 'Use latest logged value' : 'No logged value'}
                                onClick={() => copyLatestMetric(config, metric)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
