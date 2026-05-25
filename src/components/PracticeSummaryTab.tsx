import { useMemo, useState, Fragment } from 'react';
import { format } from 'date-fns';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePracticeData } from '@/context/PracticeDataContext';
import { usePracticeShotsBySessions } from '@/hooks/usePracticeShotsBySessions';
import { PRACTICE_CLUBS, SHOT_TYPES, POWER_OPTIONS, parsePracticeConfigKey } from '@/types/practiceClubs';
import { PracticeSession } from '@/types/practice';
import { cn } from '@/lib/utils';

const CLUB_ORDER: Record<string, number> = Object.fromEntries(
  PRACTICE_CLUBS.map((c, i) => [c.id, i]),
);
const SHOT_ORDER: Record<string, number> = Object.fromEntries(
  SHOT_TYPES.map((s, i) => [s.id, i]),
);
const POWER_ORDER: Record<string, number> = Object.fromEntries(
  POWER_OPTIONS.map((p, i) => [p.id, i]),
);

interface SummaryRow {
  configKey: string;
  clubId: string;
  clubName: string;
  shotName: string;
  powerName: string;
  lastPracticed: Date | null;
  carryAvg: number | null;
  carryBest: number | null;
  totalAvg: number | null;
  totalBest: number | null;
  consOverall: number | null;
  consLast: number | null;
  consLast3: number | null;
}

type SortKey =
  | 'club'
  | 'shot'
  | 'power'
  | 'last'
  | 'carry'
  | 'total'
  | 'cons';

function names(configKey: string) {
  const { club, shotType, power } = parsePracticeConfigKey(configKey);
  return {
    club: PRACTICE_CLUBS.find(c => c.id === club)?.name ?? club,
    shot: SHOT_TYPES.find(s => s.id === shotType)?.name ?? shotType,
    power: POWER_OPTIONS.find(p => p.id === power)?.name ?? power,
  };
}

function mean(vals: number[]): number | null {
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function fmt(v: number | null, digits = 0): string {
  return v === null ? '—' : v.toFixed(digits);
}

function consistencyColor(v: number | null): string {
  if (v === null) return 'text-muted-foreground';
  if (v >= 80) return 'text-green-500';
  if (v >= 60) return 'text-amber-500';
  return 'text-red-500';
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

export function PracticeSummaryTab({ onOpenLog }: { onOpenLog?: (configKey: string) => void } = {}) {
  const { practiceSessions } = usePracticeData();
  const [sortKey, setSortKey] = useState<SortKey>('club');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Group sessions by configKey & collect session ids for shot fetch
  const { groupedRows, sessionIds } = useMemo(() => {
    const byConfig = new Map<string, PracticeSession[]>();
    for (const s of practiceSessions) {
      const key = s.clubId.includes('_') ? s.clubId : `${s.clubId}_full_full`;
      (byConfig.get(key) ?? byConfig.set(key, []).get(key)!).push(s);
    }
    const ids: string[] = [];
    const grouped: Array<{
      configKey: string;
      recentSessions: PracticeSession[];
      allSessions: PracticeSession[];
    }> = [];
    for (const [configKey, sessions] of byConfig) {
      const sorted = [...sessions].sort((a, b) => b.date.getTime() - a.date.getTime());
      const recent = sorted.slice(0, 3);
      grouped.push({ configKey, recentSessions: recent, allSessions: sorted });
      recent.forEach(s => ids.push(s.id));
    }
    return { groupedRows: grouped, sessionIds: ids };
  }, [practiceSessions]);

  const { shotsBySession } = usePracticeShotsBySessions(sessionIds);

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
      const overallCons = withCons.length
        ? withCons.reduce((a, s) => a + (s.consistency?.overallScore ?? 0), 0) / withCons.length
        : null;
      const last3 = withCons.slice(0, 3);
      const last3Cons = last3.length
        ? last3.reduce((a, s) => a + (s.consistency?.overallScore ?? 0), 0) / last3.length
        : null;
      const n = names(g.configKey);
      const { club } = parsePracticeConfigKey(g.configKey);
      return {
        configKey: g.configKey,
        clubId: club,
        clubName: n.club,
        shotName: n.shot,
        powerName: n.power,
        lastPracticed: g.recentSessions[0]?.date ?? null,
        carryAvg,
        carryBest,
        totalAvg,
        totalBest,
        consOverall: overallCons,
        consLast: withCons[0]?.consistency?.overallScore ?? null,
        consLast3: last3Cons,
      };
    });
  }, [groupedRows, shotsBySession]);


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
        case 'power':
          return dir === 'asc'
            ? a.powerName.localeCompare(b.powerName)
            : b.powerName.localeCompare(a.powerName);
        case 'last':
          return nullsLast(
            a.lastPracticed?.getTime() ?? null,
            b.lastPracticed?.getTime() ?? null,
            dir,
          );
        case 'carry':
          return nullsLast(a.carryAvg, b.carryAvg, dir);
        case 'total':
          return nullsLast(a.totalAvg, b.totalAvg, dir);
        case 'cons':
          return nullsLast(a.consOverall, b.consOverall, dir);
      }
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Default direction: alpha/club asc, numerics desc
      setSortDir(['carry', 'total', 'cons', 'last'].includes(key) ? 'desc' : 'asc');
    }
  }

  function SortHeader({
    label,
    sKey,
    align = 'left',
  }: {
    label: string;
    sKey: SortKey;
    align?: 'left' | 'right';
  }) {
    const active = sortKey === sKey;
    const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th
        className={cn(
          'py-2 pr-3 select-none cursor-pointer hover:text-foreground transition-colors',
          align === 'right' ? 'text-right' : 'text-left',
        )}
        onClick={() => toggleSort(sKey)}
      >
        <span
          className={cn(
            'inline-flex items-center gap-1',
            align === 'right' && 'flex-row-reverse',
            active && 'text-foreground',
          )}
        >
          {label}
          <Icon className="h-3 w-3 opacity-60" />
        </span>
      </th>
    );
  }

  const consCell = (v: number | null) =>
    v === null ? (
      <span className="text-muted-foreground">—</span>
    ) : (
      <span className={cn('font-semibold', consistencyColor(v))}>{Math.round(v)}%</span>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Practice Summary</CardTitle>
        <CardDescription>
          One line per club / shot / power. Click any column to sort. Carry and total are means of the
          last 3 sessions; best is your top single shot.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sortedRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No practice sessions logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  <SortHeader label="Club" sKey="club" />
                  <SortHeader label="Shot" sKey="shot" />
                  <SortHeader label="Power" sKey="power" />
                  <SortHeader label="Last" sKey="last" />
                  <SortHeader label="Carry (L3 / Best)" sKey="carry" align="right" />
                  <SortHeader label="Total (L3 / Best)" sKey="total" align="right" />
                  <SortHeader label="Cons (All / Last / L3)" sKey="cons" align="right" />
                </tr>
                <tr>
                  <th colSpan={7} className="border-b border-border p-0" />
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, idx) => {
                  const prev = sortedRows[idx - 1];
                  // Only insert a club-group gap when sorted by club
                  const showGap =
                    sortKey === 'club' && prev !== undefined && prev.clubId !== row.clubId;

                  return (
                    <Fragment key={row.configKey}>
                      {showGap && (
                        <tr aria-hidden="true">
                          <td colSpan={7} className="h-3" />
                        </tr>
                      )}
                      <tr className="hover:bg-muted/40 border-b border-border/50">
                        <td className="py-2 pr-3 font-medium">
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
                        <td className="py-2 pr-3 text-muted-foreground">{row.shotName}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{row.powerName}</td>
                        <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                          {row.lastPracticed ? format(row.lastPracticed, 'dd MMM yy') : '—'}
                        </td>
                        <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                          <div>{fmt(row.carryAvg)}</div>
                          <div className="text-xs text-muted-foreground">
                            best {fmt(row.carryBest)}
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                          <div>{fmt(row.totalAvg)}</div>
                          <div className="text-xs text-muted-foreground">
                            best {fmt(row.totalBest)}
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                          {consCell(row.consOverall)}{' '}
                          <span className="text-muted-foreground">·</span> {consCell(row.consLast)}{' '}
                          <span className="text-muted-foreground">·</span> {consCell(row.consLast3)}
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
  );
}
