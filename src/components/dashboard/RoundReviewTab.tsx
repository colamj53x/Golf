import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { usePracticeShotsBySessions } from '@/hooks/usePracticeShotsBySessions';
import { formatPercent } from '@/lib/golfCalculations';
import { buildCourseShotGappingAssignments } from '@/lib/gapping';
import { buildRoundReview, RoundReviewRow, RoundReviewScope } from '@/lib/roundReview';
import { useShotClassificationRules } from '@/lib/shotClassificationRules';
import { useShotProfiles } from '@/lib/shotProfiles';
import { ClubConfig, Shot } from '@/types/golf';

interface RoundReviewTabProps {
  shots: Shot[];
  clubs: ClubConfig[];
  distanceToTargetTolerance: number;
  roundDate: string;
  scope?: RoundReviewScope;
}

const formatSqi = (value: number | null) => value === null ? '-' : `${Math.round(value)}`;
type ClubSortKey = 'club' | 'shot-type' | 'power' | 'target' | 'shots' | 'quality' | 'bad-miss' | 'accuracy';

const HCP_TARGET_SQI: Record<number, number> = {
  5: 80,
  10: 70,
  15: 60,
  20: 45,
  25: 25,
};

function getTargetValueClass(value: number | null, target: number): string {
  if (value === null) return 'text-muted-foreground';
  const displayedValue = Math.round(value);
  if (displayedValue > target) return 'text-green-600 dark:text-green-400';
  if (displayedValue < target) return 'text-red-600 dark:text-red-400';
  return 'text-amber-600 dark:text-amber-400';
}

function QualityValue({ value, targetSqi }: { value: number | null; targetSqi: number }) {
  return <span className={`font-semibold ${getTargetValueClass(value, targetSqi)}`}>{formatSqi(value)}</span>;
}

function SummaryCard({ label, round, last5, recentThird, format, target }: {
  label: string;
  round: number | null;
  last5: number | null;
  recentThird: number | null;
  format: (value: number | null) => string;
  target?: number;
}) {
  const valueClass = (value: number | null) => target === undefined ? 'text-foreground' : getTargetValueClass(value, target);
  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold ${valueClass(round)}`}>{format(round)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border bg-muted/40 p-2"><div className="text-muted-foreground">Last 5 prior rounds</div><div className={`mt-1 font-semibold ${valueClass(last5)}`}>{format(last5)}</div></div>
          <div className="rounded-md border bg-muted/40 p-2"><div className="text-muted-foreground">Prior recent 1/3</div><div className={`mt-1 font-semibold ${valueClass(recentThird)}`}>{format(recentThird)}</div></div>
        </div>
      </CardContent>
    </Card>
  );
}

function SortableHeader({ label, sortKey, activeSort, direction, onSort }: {
  label: string;
  sortKey: ClubSortKey;
  activeSort: ClubSortKey;
  direction: 'asc' | 'desc';
  onSort: (key: ClubSortKey) => void;
}) {
  const Icon = activeSort === sortKey ? direction === 'asc' ? ArrowUp : ArrowDown : ArrowUpDown;
  return <button type="button" className="inline-flex items-center gap-1 whitespace-nowrap" onClick={() => onSort(sortKey)}>{label}<Icon className="h-3.5 w-3.5" /></button>;
}

function ComparisonTable({ title, description, rows, targetSqi, simple = false, greenDistance = false, clubSort, clubSortDirection, onClubSort }: {
  title: string;
  description: string;
  rows: RoundReviewRow[];
  targetSqi: number;
  simple?: boolean;
  greenDistance?: boolean;
  clubSort?: ClubSortKey;
  clubSortDirection?: 'asc' | 'desc';
  onClubSort?: (key: ClubSortKey) => void;
}) {
  const clubTable = title === 'By Club And Shot Type' && clubSort && clubSortDirection && onClubSort;
  const lieTable = title === 'By Lie';
  const primaryColumnLabel = greenDistance ? 'Distance' : lieTable ? 'Lie' : 'Club · Shot Type';
  const header = (label: string, key: ClubSortKey) => clubTable
    ? <SortableHeader label={label} sortKey={key} activeSort={clubSort} direction={clubSortDirection} onSort={onClubSort} />
    : label;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {clubTable ? <><th>{header('Club', 'club')}</th><th>{header('Shot Type', 'shot-type')}</th><th>{header('Power', 'power')}</th><th>{header('Target', 'target')}</th></> : <th>{primaryColumnLabel}</th>}
                <th>{header('Shots', 'shots')}</th>
                {lieTable && <th>% Total</th>}
                <th>{header('Shot Quality', 'quality')}</th>
                {!simple && <th>L5 Prior</th>}
                {!simple && <th>Prior Recent 1/3</th>}
                <th>{header('Bad Miss', 'bad-miss')}</th>
                <th>{header('Accuracy', 'accuracy')}</th>
                {greenDistance && <th>Most Used Club</th>}
                {greenDistance && <th>Greens Hit</th>}
                {greenDistance && <th>Shots To Green</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key}>
                  {clubTable ? <><td className="font-medium">{row.clubLabel}</td><td>{row.shotTypeLabel}</td><td>{row.powerLabel}</td><td>{row.targetLabel}</td></> : <td className="font-medium">{row.label}</td>}
                  <td>{row.round.shotCount}</td>
                  {lieTable && <td>{formatPercent(row.shareOfTotalPct ?? null)}</td>}
                  <td><QualityValue value={row.round.shotQualityIndex} targetSqi={targetSqi} /></td>
                  {!simple && <td><QualityValue value={row.last5.shotQualityIndex} targetSqi={targetSqi} /></td>}
                  {!simple && <td><QualityValue value={row.recentThird.shotQualityIndex} targetSqi={targetSqi} /></td>}
                  <td>{formatPercent(row.round.badMissPct)}</td>
                  <td>{formatPercent(row.round.onTargetPct)}</td>
                  {greenDistance && (
                    <td>
                      {row.dominantClubShotLabel && row.dominantClubShotPct !== null && row.dominantClubShotPct !== undefined ? (
                        <div>
                          <div className="font-medium">{row.dominantClubShotLabel}</div>
                          <div className="text-xs text-muted-foreground">{formatPercent(row.dominantClubShotPct)} of shots</div>
                        </div>
                      ) : '-'}
                    </td>
                  )}
                  {greenDistance && <td>{formatPercent(row.round.greensHitRawPct)}</td>}
                  {greenDistance && <td>{row.avgShotsToGreen === null ? '-' : row.avgShotsToGreen.toFixed(1)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function RoundReviewTab({ shots, clubs, distanceToTargetTolerance, roundDate, scope = 'round' }: RoundReviewTabProps) {
  const { gappingHcpTarget } = useGolfData();
  const { practiceConfigs, practiceSessions } = usePracticeData();
  const profiles = useShotProfiles();
  const shotClassificationRules = useShotClassificationRules();
  const practiceSessionIds = useMemo(() => practiceSessions.map((session) => session.id), [practiceSessions]);
  const { shotsBySession } = usePracticeShotsBySessions(practiceSessionIds);
  const [clubSort, setClubSort] = useState<ClubSortKey>('club');
  const [clubSortDirection, setClubSortDirection] = useState<'asc' | 'desc'>('asc');
  const gappingAssignments = useMemo(() => buildCourseShotGappingAssignments({
    profiles,
    shots,
    practiceSessions,
    practiceConfigs,
    shotsBySession,
    gappingHcpTarget,
    shotClassificationRules,
  }).shotToAssignment, [gappingHcpTarget, practiceConfigs, practiceSessions, profiles, shots, shotsBySession, shotClassificationRules]);
  const review = useMemo(
    () => buildRoundReview(shots, clubs, distanceToTargetTolerance, roundDate, gappingAssignments, scope),
    [shots, clubs, distanceToTargetTolerance, roundDate, gappingAssignments, scope]
  );
  const targetSqi = HCP_TARGET_SQI[gappingHcpTarget] ?? 70;

  if (review.round.shotCount === 0) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">No non-putting shots recorded in this round.</CardContent></Card>;
  }
  const sortedClubAndTypeRows = [...review.clubAndTypeRows].sort((a, b) => {
    const direction = clubSortDirection === 'asc' ? 1 : -1;
    if (clubSort === 'shots') return direction * (a.round.shotCount - b.round.shotCount);
    if (clubSort === 'quality') return direction * ((a.round.shotQualityIndex ?? -1) - (b.round.shotQualityIndex ?? -1));
    if (clubSort === 'bad-miss') return direction * (a.round.badMissPct - b.round.badMissPct);
    if (clubSort === 'accuracy') return direction * (a.round.onTargetPct - b.round.onTargetPct);
    if (clubSort === 'shot-type') return direction * (a.shotTypeLabel ?? '').localeCompare(b.shotTypeLabel ?? '');
    if (clubSort === 'power') return direction * (a.powerLabel ?? '').localeCompare(b.powerLabel ?? '');
    if (clubSort === 'target') return direction * (a.targetLabel ?? '').localeCompare(b.targetLabel ?? '');
    return direction * ((a.clubSortIndex ?? Number.POSITIVE_INFINITY) - (b.clubSortIndex ?? Number.POSITIVE_INFINITY)
      || (a.clubLabel ?? '').localeCompare(b.clubLabel ?? ''));
  });
  const handleClubSort = (key: ClubSortKey) => {
    if (key === clubSort) {
      setClubSortDirection(direction => direction === 'asc' ? 'desc' : 'asc');
      return;
    }
    setClubSort(key);
    setClubSortDirection(key === 'club' || key === 'shot-type' || key === 'power' || key === 'target' ? 'asc' : 'desc');
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label={scope === 'round' ? 'Shot Quality' : `${review.label} Shot Quality`} round={review.round.shotQualityIndex} last5={review.last5.shotQualityIndex} recentThird={review.recentThird.shotQualityIndex} format={formatSqi} target={targetSqi} />
        <SummaryCard label="Bad Miss" round={review.round.badMissPct} last5={review.last5.shotCount ? review.last5.badMissPct : null} recentThird={review.recentThird.shotCount ? review.recentThird.badMissPct : null} format={formatPercent} />
        <SummaryCard label="Accuracy" round={review.round.onTargetPct} last5={review.last5.shotCount ? review.last5.onTargetPct : null} recentThird={review.recentThird.shotCount ? review.recentThird.onTargetPct : null} format={formatPercent} />
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        Shot Quality colours use your {gappingHcpTarget} HCP target ({targetSqi} SQI): <span className="font-medium text-green-600 dark:text-green-400">green above</span>, <span className="font-medium text-amber-600 dark:text-amber-400">amber on target</span>, <span className="font-medium text-red-600 dark:text-red-400">red below</span>.
      </p>

      <ComparisonTable title="By Club And Shot Type" description="Every non-putting shot in this round, assigned by the same Club, Shot Type, Power, and Target classifier used by Gapping. Click a column heading to sort." rows={sortedClubAndTypeRows} targetSqi={targetSqi} clubSort={clubSort} clubSortDirection={clubSortDirection} onClubSort={handleClubSort} />

      <Card>
        <CardHeader>
          <CardTitle>Green Target Totals</CardTitle>
          <CardDescription>Roll-up counts for shots targeting the green. The distance bands below are non-overlapping.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {review.greenDistanceRollups.map(row => (
            <div key={row.key} className="rounded-md border bg-muted/30 p-3">
              <div className="text-sm text-muted-foreground">{row.label}</div>
              <div className="text-2xl font-bold">{row.round.shotCount}</div>
              <div className="text-xs text-muted-foreground">shots targeting the green</div>
            </div>
          ))}
          {review.distanceWarning && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-800 sm:col-span-3">
              {review.distanceWarning}
            </div>
          )}
        </CardContent>
      </Card>

      {!review.distanceWarning && <ComparisonTable title="Greens Targeted By Distance" description={`Only shots targeting the green. Each shot appears in one distance band. ${review.hasShotSequence ? 'Shots To Green uses the uploaded hole sequence.' : 'Re-upload this round to add hole sequence and calculate Shots To Green.'}`} rows={review.greenDistanceRows} targetSqi={targetSqi} greenDistance />}
      <ComparisonTable title="By Lie" description="Starting lie for each non-putting shot in this round." rows={review.lieRows} targetSqi={targetSqi} simple />
    </div>
  );
}
