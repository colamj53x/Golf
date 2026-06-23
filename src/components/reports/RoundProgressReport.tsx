import { useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGolfData } from '@/context/GolfDataContext';
import { getShotDateKey } from '@/lib/golfCalculations';
import { buildRoundReview, isPuttingShot } from '@/lib/roundReview';
import { getBenchmarkForHcp, HCP_BENCHMARKS } from '@/lib/roundReviewInsights';

type ProgressMode = 'overall' | 'tee' | 'approach' | 'short';

export function RoundProgressReport() {
  const { shots, clubs, distanceToTargetTolerance } = useGolfData();
  const [mode, setMode] = useState<ProgressMode>('overall');
  const [benchmarkHcp, setBenchmarkHcp] = useState(10);
  const latestRound = useMemo(() => [...new Set(shots.filter((shot) => !isPuttingShot(shot)).map((shot) => getShotDateKey(shot.date)))]
    .sort((a, b) => b.localeCompare(a))[0] ?? '', [shots]);
  const review = useMemo(
    () => buildRoundReview(shots, clubs, distanceToTargetTolerance, latestRound, undefined, 'all'),
    [clubs, distanceToTargetTolerance, latestRound, shots],
  );
  const benchmark = getBenchmarkForHcp(benchmarkHcp);
  const benchmarkOptions = Object.keys(HCP_BENCHMARKS).map(Number).sort((a, b) => b - a);
  const lines = mode === 'tee'
    ? [
        { key: 'teeShotQuality', label: 'Tee Shot Quality', color: 'hsl(var(--primary))' },
        { key: 'teeTargetSuccess', label: 'Tee Target Success', color: '#0ea5e9' },
        { key: 'teeSafeShotRate', label: 'Tee Safe Shot Rate', color: '#16a34a' },
      ]
    : mode === 'approach'
      ? [
          { key: 'approachShotQuality', label: 'Green Target Quality', color: 'hsl(var(--primary))' },
          { key: 'approachTargetSuccess', label: 'Green Target Success', color: '#0ea5e9' },
          { key: 'approachSafeShotRate', label: 'Safe Shot Rate', color: '#16a34a' },
        ]
      : mode === 'short'
        ? [
            { key: 'shortGameShotQuality', label: 'Short Game Quality', color: 'hsl(var(--primary))' },
            { key: 'shortGameScoringZoneSuccess', label: 'Scoring Zone Success', color: '#d97706' },
            { key: 'shortGameSafeShotRate', label: 'Safe Shot Rate', color: '#16a34a' },
          ]
        : [
            { key: 'shotQuality', label: 'Shot Quality', color: 'hsl(var(--primary))' },
            { key: 'targetSuccess', label: 'Target Success', color: '#0ea5e9' },
            { key: 'safeShotRate', label: 'Safe Shot Rate', color: '#16a34a' },
            { key: 'scoringZoneSuccess', label: 'Scoring Zone Success', color: '#d97706' },
          ];
  const reference = mode === 'tee'
    ? benchmark.teeShotQuality
    : mode === 'approach'
      ? benchmark.greenTargetQuality
      : mode === 'short'
        ? benchmark.scoringZoneSuccess
        : benchmark.shotQuality;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Round Progress Over Time</CardTitle>
            <CardDescription>Detailed round trend view. Each point is one block of recorded rounds, from earliest to latest.</CardDescription>
          </div>
          <Select value={benchmarkHcp.toString()} onValueChange={(value) => setBenchmarkHcp(Number(value))}>
            <SelectTrigger className="w-full lg:w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>{benchmarkOptions.map((hcp) => <SelectItem key={hcp} value={hcp.toString()}>{`Target ${hcp} HCP`}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {([['overall', 'Overall'], ['tee', 'Tee / Driving'], ['approach', 'Approach'], ['short', 'Short Game']] as Array<[ProgressMode, string]>).map(([value, label]) => (
            <Button key={value} size="sm" variant={mode === value ? 'default' : 'outline'} onClick={() => setMode(value)}>{label}</Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {review.progress.length < 2 ? <div className="py-12 text-center text-muted-foreground">Not enough rounds yet to show progress over time.</div> : (
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={review.progress} margin={{ top: 12, right: 24, left: -8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" />
              <YAxis domain={[0, 100]} unit="%" />
              <Tooltip formatter={(value: number) => `${Math.round(value)}%`} />
              <Legend />
              <ReferenceLine y={reference} stroke="hsl(var(--primary))" strokeDasharray="6 4" label={`${benchmarkHcp} HCP target`} />
              {lines.map((line) => <Line key={line.key} type="monotone" dataKey={line.key} name={line.label} stroke={line.color} strokeWidth={line.key.toLowerCase().includes('quality') ? 2.5 : 2} connectNulls />)}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
