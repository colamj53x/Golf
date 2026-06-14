import { useMemo, useState, Fragment } from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
import { ArrowDown, ArrowUp, ArrowUpDown, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { usePracticeShotsBySessions } from '@/hooks/usePracticeShotsBySessions';
import { POWER_OPTIONS, PRACTICE_CLUBS, SHOT_TYPES, parsePracticeConfigKey } from '@/types/practiceClubs';
import { PracticeSession } from '@/types/practice';
import { Shot } from '@/types/golf';
import { ShotProfile, useShotProfiles } from '@/lib/shotProfiles';
import { useShotClassificationRules } from '@/lib/shotClassificationRules';
import { buildCourseShotGappingAssignments, visibleGappingConfigKey } from '@/lib/gapping';
import { cn } from '@/lib/utils';
import { getClubConfigId } from '@/lib/golfCalculations';
import { buildPracticePriorities, type PracticePriority } from '@/lib/practicePriorities';

const CLUB_ORDER: Record<string, number> = Object.fromEntries(
  PRACTICE_CLUBS.map((c, i) => [c.id, i]),
);
const SHOT_ORDER: Record<string, number> = Object.fromEntries(
  SHOT_TYPES.map((s, i) => [s.id, i]),
);
const POWER_ORDER: Record<string, number> = Object.fromEntries(
  POWER_OPTIONS.map((power, i) => [power.id, i]),
);

interface SummaryRow {
  configKey: string;
  clubId: string;
  clubName: string;
  shotName: string;
  shotType: string;
  powerId: string;
  description: string;
  lastPracticed: Date | null;
  carryAvg: number | null;
  carryBest: number | null;
  totalAvg: number | null;
  totalBest: number | null;
  reliancePerRound: number | null;
  courseShotCount: number;
  last20Score: number | null;
  last20Count: number;
  last3PracticeScore: number | null;
  last3PracticeCount: number;
  priority: PracticePriority | null;
}

type SortKey =
  | 'club'
  | 'shot'
  | 'last'
  | 'priority'
  | 'carry'
  | 'total'
  | 'reliance'
  | 'last20'
  | 'last3';

function names(configKey: string) {
  const { club, shotType } = parsePracticeConfigKey(configKey);
  return {
    club: PRACTICE_CLUBS.find(c => c.id === club)?.name ?? club,
    shot: SHOT_TYPES.find(s => s.id === shotType)?.name ?? shotType,
  };
}

function getShotLabel(shotType: string): string {
  return SHOT_TYPES.find((shot) => shot.id === shotType)?.name ?? shotType;
}

function powerBadgeClass(power: string): string {
  if (power === 'full') return 'border-green-600 bg-green-50 text-green-800 hover:bg-green-50';
  return 'border-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-50';
}

function profileDescription(profile: ShotProfile | undefined): string {
  if (!profile) return '';
  return profile.technique || profile.routine || '';
}

function mean(vals: number[]): number | null {
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function fmt(v: number | null, digits = 0): string {
  return v === null ? '—' : v.toFixed(digits);
}

function recencyBadgeClass(date: Date | null): string {
  if (!date) return 'border-muted bg-muted/40 text-muted-foreground hover:bg-muted/40';
  const days = differenceInCalendarDays(new Date(), date);
  if (days <= 31) return 'border-green-600 bg-green-50 text-green-800 hover:bg-green-50';
  if (days <= 62) return 'border-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-50';
  return 'border-red-600 bg-red-50 text-red-800 hover:bg-red-50';
}

function fallbackCourseConfigKey(clubId: string): string | null {
  return PRACTICE_CLUBS.some((club) => club.id === clubId) ? `${clubId}_full_full` : null;
}

function primaryDistanceMetric(row: SummaryRow): 'total' | 'carry' {
  if (row.shotType === 'chip' || row.shotType === 'bump') return 'total';
  if (row.shotType === 'pitch') return 'carry';
  if (['dr', '5w', '4h', '5h'].includes(row.clubId)) return 'total';
  if ((row.clubId === '6i' || row.clubId === '7i') && (row.shotType === 'full' || row.shotType === 'punch')) return 'total';
  return 'carry';
}

function metricValueClass(isPrimary: boolean): string {
  return cn(
    'inline-flex min-w-10 justify-center rounded-full border px-2 py-0.5 text-xs font-semibold leading-none',
    isPrimary
      ? 'border-green-600 bg-green-50 text-green-800'
      : 'border-transparent bg-transparent text-foreground',
  );
}

type PriorityLevel = 'high' | 'medium' | 'low' | 'none';

function priorityBadgeClass(level: PriorityLevel): string {
  if (level === 'high') return 'border-red-600 bg-red-50 text-red-800 hover:bg-red-50';
  if (level === 'medium') return 'border-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-50';
  if (level === 'low') return 'border-green-600 bg-green-50 text-green-800 hover:bg-green-50';
  return 'border-muted bg-muted/40 text-muted-foreground hover:bg-muted/40';
}

function priorityLabel(level: PriorityLevel): string {
  if (level === 'high') return 'High';
  if (level === 'medium') return 'Med';
  if (level === 'low') return 'Low';
  return 'No data';
}

function prioritySignal(row: SummaryRow): { level: PriorityLevel; score: number | null; title: string } {
  if (!row.priority) return { level: 'none', score: null, title: 'No on-course signal yet' };
  const score = row.priority.courseImpactScore;
  const level: PriorityLevel = score >= 1 ? 'high' : score >= 0.35 ? 'medium' : 'low';

  return {
    level,
    score,
    title: `${priorityLabel(level)} course impact · ${row.priority.evidence}`,
  };
}

function shotSafeScore(shot: Shot): boolean {
  const endLie = shot.endLie.toLowerCase();
  return endLie.includes('fairway') || endLie.includes('green') || endLie.includes('fringe') || endLie.includes('hole');
}

function scoreShots(shots: Shot[]): number | null {
  if (!shots.length) return null;
  return (shots.filter(shotSafeScore).length / shots.length) * 100;
}

function signalClass(value: number | null, greenAt: number, amberAt: number): string {
  if (value === null) return 'border-muted bg-muted';
  if (value >= greenAt) return 'border-green-600 bg-green-600';
  if (value >= amberAt) return 'border-amber-500 bg-amber-500';
  return 'border-red-600 bg-red-600';
}

function SignalDot({
  value,
  title,
  greenAt,
  amberAt,
}: {
  value: number | null;
  title: string;
  greenAt: number;
  amberAt: number;
}) {
  return (
    <span
      className={cn('inline-block h-3.5 w-3.5 rounded-full border', signalClass(value, greenAt, amberAt))}
      title={title}
      aria-label={title}
    />
  );
}

function reliabilityTitle(value: number | null, count: number): string {
  if (value === null) return 'No on-course usage';
  return `${value.toFixed(1)} shots per round · ${count} total shots`;
}

// Sort helpers
function nullsLast(a: number | null, b: number | null, dir: 'asc' | 'desc'): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1; // nulls always last
  if (b === null) return -1;
  return dir === 'asc' ? a - b : b - a;
}

function clubOrderCompare(a: SummaryRow, b: SummaryRow): number {
  const ak = parsePracticeConfigKey(a.configKey);
  const bk = parsePracticeConfigKey(b.configKey);
  return (
    (CLUB_ORDER[ak.club] ?? 999) - (CLUB_ORDER[bk.club] ?? 999) ||
    (SHOT_ORDER[ak.shotType] ?? 999) - (SHOT_ORDER[bk.shotType] ?? 999) ||
    (POWER_ORDER[ak.power] ?? 999) - (POWER_ORDER[bk.power] ?? 999)
  );
}

export function PracticeSummaryTab({
  onOpenLog,
  onAddClubShot,
}: {
  onOpenLog?: (configKey: string) => void;
  onAddClubShot?: () => void;
} = {}) {
  const { shots, gappingHcpTarget } = useGolfData();
  const { practiceConfigs, practiceSessions } = usePracticeData();
  const profiles = useShotProfiles();
  const shotClassificationRules = useShotClassificationRules();
  const [sortKey, setSortKey] = useState<SortKey>('club');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const practiceSessionIds = useMemo(() => practiceSessions.map((session) => session.id), [practiceSessions]);
  const { shotsBySession } = usePracticeShotsBySessions(practiceSessionIds);
  const gappingAssignments = useMemo(() => buildCourseShotGappingAssignments({
    profiles,
    shots,
    practiceSessions,
    practiceConfigs,
    shotsBySession,
    gappingHcpTarget,
    shotClassificationRules,
  }), [gappingHcpTarget, practiceConfigs, practiceSessions, profiles, shots, shotsBySession, shotClassificationRules]);
  const prioritiesByConfig = useMemo(() => new Map(
    buildPracticePriorities({
      shots,
      profiles,
      practiceSessions,
      practiceConfigs,
      shotsBySession,
      gappingHcpTarget,
      shotClassificationRules,
    }).map((priority) => [visibleGappingConfigKey(priority.configKey), priority]),
  ), [gappingHcpTarget, practiceConfigs, practiceSessions, profiles, shots, shotsBySession, shotClassificationRules]);

  const courseSignals = useMemo(() => {
    const shotsByConfig = new Map<string, Shot[]>();

    const courseShots = shots.filter((shot) => {
      const clubId = getClubConfigId(shot.club);
      return fallbackCourseConfigKey(clubId) !== null;
    });
    const roundDates = new Set(courseShots.map((shot) => format(shot.date, 'yyyy-MM-dd')));

    for (const shot of courseShots) {
      const clubId = getClubConfigId(shot.club);
      const configKey = gappingAssignments.shotToAssignment.get(shot.id)?.configKey ?? fallbackCourseConfigKey(clubId);
      if (!configKey) continue;
      shotsByConfig.set(configKey, [...(shotsByConfig.get(configKey) ?? []), shot]);
    }

    return { shotsByConfig, roundCount: roundDates.size };
  }, [gappingAssignments, shots]);

  const gappingOptions = gappingAssignments.options;

  // Group practice log sessions by visible gapping key. Values still come from logs only.
  const groupedRows = useMemo(() => {
    const byConfig = new Map<string, PracticeSession[]>();
    for (const s of practiceSessions) {
      const rawKey = s.clubId.includes('_') ? s.clubId : `${s.clubId}_full_full`;
      const key = visibleGappingConfigKey(rawKey);
      (byConfig.get(key) ?? byConfig.set(key, []).get(key)!).push(s);
    }

    const allOptions = new Map(gappingOptions);
    for (const configKey of byConfig.keys()) {
      const parsed = parsePracticeConfigKey(configKey);
      if (!parsed.club || !parsed.shotType || !parsed.power) continue;
      const fallbackProfile = profiles[`${parsed.club}_${parsed.shotType}_${parsed.power === 'full' ? 'full' : '9pm'}`]
        ?? profiles[`${parsed.club}_${parsed.shotType}_full`];
      if (fallbackProfile && !allOptions.has(configKey)) {
        allOptions.set(configKey, { configKey, profile: fallbackProfile });
      }
    }

    const grouped: Array<{
      configKey: string;
      profile: ShotProfile | undefined;
      recentSessions: PracticeSession[];
      allSessions: PracticeSession[];
    }> = [];

    for (const option of allOptions.values()) {
      const configKey = option.configKey;
      const sessions = byConfig.get(configKey) ?? [];
      const sorted = [...sessions].sort((a, b) => b.date.getTime() - a.date.getTime());
      const recent = sorted.slice(0, 3);
      grouped.push({
        configKey,
        profile: option.profile,
        recentSessions: recent,
        allSessions: sorted,
      });
    }
    return grouped;
  }, [gappingOptions, practiceSessions, profiles]);

  // Build full rows with computed metrics
  const rows = useMemo<SummaryRow[]>(() => {
    // Helper: average of a session-level metric across sessions (uses midpoint of min/max).
    const sessionMetricValues = (sessions: PracticeSession[], metricId: string): number[] => {
      const vals: number[] = [];
      for (const s of sessions) {
        const m = s.metrics.find(x => x.metricId === metricId);
        if (!m) continue;
        if (typeof m.valueMin === 'number' && typeof m.valueMax === 'number') {
          vals.push((m.valueMin + m.valueMax) / 2);
        } else if (typeof m.valueMin === 'number') {
          vals.push(m.valueMin);
        } else if (typeof m.valueMax === 'number') {
          vals.push(m.valueMax);
        } else {
          const n = parseFloat(m.valueDisplay);
          if (!Number.isNaN(n)) vals.push(n);
        }
      }
      return vals;
    };

    return groupedRows.map(g => {
      // 1) Per-shot data (preferred when present)
      const recentCarry: number[] = [];
      const recentTotal: number[] = [];
      for (const s of g.recentSessions) {
        const shots = shotsBySession[s.id] ?? [];
        for (const shot of shots) {
          const c = shot.metrics.carry as number | undefined;
          const t = shot.metrics.total as number | undefined;
          if (typeof c === 'number') recentCarry.push(c);
          if (typeof t === 'number') recentTotal.push(t);
        }
      }

      // 2) Fall back to session-level metric values (no per-shot data logged)
      let carryAvg = mean(recentCarry);
      let carryBest = recentCarry.length ? Math.max(...recentCarry) : null;
      let totalAvg = mean(recentTotal);
      let totalBest = recentTotal.length ? Math.max(...recentTotal) : null;

      if (carryAvg === null) {
        const sessCarry = sessionMetricValues(g.recentSessions, 'carry');
        if (sessCarry.length) {
          carryAvg = mean(sessCarry);
          // Best across recent sessions (use valueMax when available)
          const bests = g.recentSessions
            .map(s => s.metrics.find(m => m.metricId === 'carry')?.valueMax)
            .filter((v): v is number => typeof v === 'number');
          carryBest = bests.length ? Math.max(...bests) : carryAvg;
        }
      }
      if (totalAvg === null) {
        const sessTotal = sessionMetricValues(g.recentSessions, 'total_distance');
        if (sessTotal.length) {
          totalAvg = mean(sessTotal);
          const bests = g.recentSessions
            .map(s => s.metrics.find(m => m.metricId === 'total_distance')?.valueMax)
            .filter((v): v is number => typeof v === 'number');
          totalBest = bests.length ? Math.max(...bests) : totalAvg;
        }
      }

      const withCons = g.allSessions.filter(s => s.consistency !== undefined);
      const last3 = withCons.slice(0, 3);
      const last3Cons = last3.length
        ? last3.reduce((a, s) => a + (s.consistency?.overallScore ?? 0), 0) / last3.length
        : null;
      const n = names(g.configKey);
      const { club, shotType, power } = parsePracticeConfigKey(g.configKey);
      const recentCourseShots = [...(courseSignals.shotsByConfig.get(g.configKey) ?? [])]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 20);
      const last20Score = scoreShots(recentCourseShots);
      const courseShotCount = courseSignals.shotsByConfig.get(g.configKey)?.length ?? 0;
      const reliancePerRound = courseSignals.roundCount > 0 ? courseShotCount / courseSignals.roundCount : null;
      const priority = prioritiesByConfig.get(g.configKey) ?? null;
      return {
        configKey: g.configKey,
        clubId: club,
        clubName: n.club,
        shotName: getShotLabel(shotType),
        shotType,
        powerId: power,
        description: profileDescription(g.profile),
        lastPracticed: g.recentSessions[0]?.date ?? null,
        carryAvg,
        carryBest,
        totalAvg,
        totalBest,
        reliancePerRound,
        courseShotCount,
        last20Score,
        last20Count: recentCourseShots.length,
        last3PracticeScore: last3Cons,
        last3PracticeCount: last3.length,
        priority,
      };
    });
  }, [courseSignals, groupedRows, prioritiesByConfig, shotsBySession]);


  // Apply sorting
  const sortedRows = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const dir = sortDir;
      switch (sortKey) {
        case 'club':
          return dir === 'asc' ? clubOrderCompare(a, b) : clubOrderCompare(b, a);
        case 'shot':
          return dir === 'asc'
            ? a.shotName.localeCompare(b.shotName)
            : b.shotName.localeCompare(a.shotName);
        case 'last':
          return nullsLast(
            a.lastPracticed?.getTime() ?? null,
            b.lastPracticed?.getTime() ?? null,
            dir,
          );
        case 'priority':
          return nullsLast(prioritySignal(a).score, prioritySignal(b).score, dir);
        case 'carry':
          return nullsLast(a.carryAvg, b.carryAvg, dir);
        case 'total':
          return nullsLast(a.totalAvg, b.totalAvg, dir);
        case 'reliance':
          return nullsLast(a.reliancePerRound, b.reliancePerRound, dir);
        case 'last20':
          return nullsLast(a.last20Score, b.last20Score, dir);
        case 'last3':
          return nullsLast(a.last3PracticeScore, b.last3PracticeScore, dir);
      }
    });
    return arr;
  }, [rows, sortKey, sortDir]);
  const topPriorityRows = useMemo(() => (
    [...rows]
      .filter(row => prioritySignal(row).score !== null)
      .sort((a, b) => (prioritySignal(b).score ?? -1) - (prioritySignal(a).score ?? -1))
      .slice(0, 3)
  ), [rows]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Default direction: alpha/club asc, numerics desc
      setSortDir(['carry', 'total', 'reliance', 'last20', 'last3', 'last', 'priority'].includes(key) ? 'desc' : 'asc');
    }
  }

  function SortHeader({
    label,
    sKey,
    align = 'left',
  }: {
    label: string;
    sKey: SortKey;
    align?: 'left' | 'center' | 'right';
  }) {
    const active = sortKey === sKey;
    const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th
        className={cn(
          'py-1.5 pr-2 select-none cursor-pointer hover:text-foreground transition-colors',
          align === 'right' && 'text-right',
          align === 'center' && 'text-center',
          align === 'left' && 'text-left',
        )}
        onClick={() => toggleSort(sKey)}
      >
        <span
          className={cn(
            'inline-flex items-center gap-1',
            align === 'right' && 'flex-row-reverse',
            align === 'center' && 'justify-center',
            active && 'text-foreground',
          )}
        >
          {label}
          <Icon className="h-3 w-3 opacity-60" />
        </span>
      </th>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle>Next Practice Session</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {topPriorityRows[0]
              ? `Start with ${topPriorityRows[0].clubName} ${topPriorityRows[0].shotName.toLowerCase()} work. It has the highest expected on-course impact from reliance, shot quality, and costly misses.`
              : 'Capture a round or practice session to generate your next recommended block.'}
          </p>
        </CardContent>
      </Card>
      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-bold">Top 3 Practice Priorities</h2>
          <p className="text-sm text-muted-foreground">Start with the shots most likely to improve your next round.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {topPriorityRows.map((row, index) => {
            const priority = prioritySignal(row);
            return (
              <Card key={row.configKey}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Priority {index + 1}</span>
                    <Target className="h-4 w-4 text-primary" />
                  </div>
                  <div className="mt-3 font-bold">{row.clubName} · {row.shotName}</div>
                  <p className="mt-2 text-xs text-muted-foreground">{priority.title}</p>
                  {onOpenLog && <Button className="mt-4" size="sm" variant="outline" onClick={() => onOpenLog(row.configKey)}>Open practice log</Button>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
      <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Practice Detail</CardTitle>
        {onAddClubShot && (
          <Button variant="outline" size="sm" onClick={onAddClubShot}>
            Add Club/Shot
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {sortedRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No practice shot options configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-auto min-w-[820px] text-sm border-separate border-spacing-0">
              <colgroup>
                <col className="w-36" />
                <col className="w-28" />
                <col className="w-28" />
                <col className="w-24" />
                <col className="w-20" />
                <col className="w-20" />
                <col className="w-20" />
                <col className="w-28" />
                <col className="w-28" />
              </colgroup>
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  <SortHeader label="Club" sKey="club" />
                  <SortHeader label="Shot" sKey="shot" />
                  <SortHeader label="Last" sKey="last" />
                  <SortHeader label="Priority" sKey="priority" align="center" />
                  <SortHeader label="Reliance" sKey="reliance" align="center" />
                  <SortHeader label="Last 20" sKey="last20" align="center" />
                  <SortHeader label="Last 3" sKey="last3" align="center" />
                  <SortHeader label="Total" sKey="total" align="right" />
                  <SortHeader label="Carry" sKey="carry" align="right" />
                </tr>
                <tr>
                  <th colSpan={9} className="border-b border-border p-0" />
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, idx) => {
                  const prev = sortedRows[idx - 1];
                  const primaryMetric = primaryDistanceMetric(row);
                  const priority = prioritySignal(row);
                  // Only insert a club-group gap when sorted by club
                  const showGap =
                    sortKey === 'club' && prev !== undefined && prev.clubId !== row.clubId;

                  return (
                    <Fragment key={row.configKey}>
                      {showGap && (
                        <tr aria-hidden="true">
                          <td colSpan={9} className="h-3" />
                        </tr>
                      )}
                      <tr className="hover:bg-muted/40 border-b border-border/50">
                        <td className="py-1.5 pr-3 font-medium whitespace-nowrap">
                          {onOpenLog ? (
                            <button
                              type="button"
                              onClick={() => onOpenLog(row.configKey)}
                              className="text-left hover:text-primary hover:underline underline-offset-2 transition-colors"
                            >
                              {row.clubName}
                            </button>
                          ) : (
                            row.clubName
                          )}
                        </td>
                        <td className="py-1.5 pr-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn('min-w-14 justify-center px-2 py-0.5 text-xs leading-none', powerBadgeClass(row.powerId))}
                            >
                              {row.shotName}
                            </Badge>
                            {row.description && (
                              <span className="sr-only">
                                {row.description}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={cn('w-20 justify-center px-2 py-0.5 text-xs leading-none', recencyBadgeClass(row.lastPracticed))}
                          >
                            {row.lastPracticed ? format(row.lastPracticed, 'dd MMM yy') : 'No data'}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-2 text-center whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={cn('w-16 justify-center px-2 py-0.5 text-xs leading-none', priorityBadgeClass(priority.level))}
                            title={priority.title}
                          >
                            {priorityLabel(priority.level)}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-1.5 text-center whitespace-nowrap tabular-nums">
                          <SignalDot
                            value={row.reliancePerRound}
                            greenAt={1}
                            amberAt={0.25}
                            title={reliabilityTitle(row.reliancePerRound, row.courseShotCount)}
                          />
                        </td>
                        <td className="py-1.5 px-1.5 text-center whitespace-nowrap tabular-nums">
                          <SignalDot
                            value={row.last20Score}
                            greenAt={65}
                            amberAt={40}
                            title={
                              row.last20Score === null
                                ? 'No recent on-course shots'
                                : `${Math.round(row.last20Score)}% safe from last ${row.last20Count} on-course shots`
                            }
                          />
                        </td>
                        <td className="py-1.5 px-1.5 text-center whitespace-nowrap tabular-nums">
                          <SignalDot
                            value={row.last3PracticeScore}
                            greenAt={80}
                            amberAt={60}
                            title={
                              row.last3PracticeScore === null
                                ? 'No scored recent practices'
                                : `${Math.round(row.last3PracticeScore)}% from last ${row.last3PracticeCount} practices`
                            }
                          />
                        </td>
                        <td className="py-1.5 pl-2 pr-2 text-right whitespace-nowrap tabular-nums">
                          <div className="flex justify-end">
                            <span className={metricValueClass(primaryMetric === 'total')}>{fmt(row.totalAvg)}</span>
                          </div>
                          <div className="text-[11px] leading-tight text-muted-foreground">
                            best {fmt(row.totalBest)}
                          </div>
                        </td>
                        <td className="py-1.5 pl-3 pr-2 text-right whitespace-nowrap tabular-nums">
                          <div className="flex justify-end">
                            <span className={metricValueClass(primaryMetric === 'carry')}>{fmt(row.carryAvg)}</span>
                          </div>
                          <div className="text-[11px] leading-tight text-muted-foreground">
                            best {fmt(row.carryBest)}
                          </div>
                        </td>

                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      </Card>
    </div>
  );
}
