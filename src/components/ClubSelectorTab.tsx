import { useState, useMemo } from 'react';
import { useGolfData } from '@/context/GolfDataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, TrendingUp, AlertCircle } from 'lucide-react';
import { processShot, getClubConfigId } from '@/lib/golfCalculations';

// Shot quality levels - cumulative (at this level or better counts toward ≤10 handicap)
const GOOD_SHOT_LEVELS = ['Pro', 'Elite Am', '0 Handicap', '5 Handicap', '10 Handicap'];

interface ClubResult {
  club: string;
  clubName: string;
  goodShotPct: number;
  totalShots: number;
  usagePct: number; // % of shots at this distance using this club
  dataConfidence: 'high' | 'medium' | 'low' | 'very-low'; // Based on sample size
  avgDistanceToTarget: number | null;
  greensHitPct: number;
  shotConfidence: number; // Weighted composite score (0-100)
}

// Calculate weighted shot confidence score (excludes sample size - that's shown separately)
const calculateShotConfidence = (
  goodShotPct: number,
  greensHitPct: number,
  avgProximity: number | null
): number => {
  // Weights for each component (total = 100%)
  const WEIGHTS = {
    successRate: 0.50,    // 50% - Primary success metric
    greensHit: 0.30,      // 30% - Green targeting ability
    proximity: 0.20,      // 20% - How close to the hole
  };

  // Success rate component (0-100)
  const successComponent = goodShotPct;

  // Greens hit component (0-100)
  const greensComponent = greensHitPct;

  // Proximity component (inverse - closer is better, max 15m expected)
  // If no proximity data, use neutral 50
  let proximityComponent = 50;
  if (avgProximity !== null) {
    // 0m = 100, 15m+ = 0
    proximityComponent = Math.max(0, Math.min(100, 100 - (avgProximity / 15) * 100));
  }

  // Weighted sum
  const score = 
    (successComponent * WEIGHTS.successRate) +
    (greensComponent * WEIGHTS.greensHit) +
    (proximityComponent * WEIGHTS.proximity);

  return Math.round(score);
};

export function ClubSelectorTab() {
  const { shots, clubs, isLoading, availableStartLies, distanceToTargetTolerance } = useGolfData();
  
  // Filter inputs
  const [targetDistance, setTargetDistance] = useState<string>('120');
  const [distanceRange, setDistanceRange] = useState<string>('10');
  const [startLie, setStartLie] = useState<string>('all');
  const [desiredEndLie, setDesiredEndLie] = useState<string>('green');

  // End lie options
  const endLieOptions = [
    { value: 'green', label: 'Green / Fringe / Hole' },
    { value: 'fairway', label: 'Fairway' },
    { value: 'any', label: 'Any (no penalty)' },
  ];

  const clubResults = useMemo(() => {
    if (!shots.length) return [];

    const distance = parseFloat(targetDistance) || 0;
    const range = parseFloat(distanceRange) || 10;
    const minDist = distance - range;
    const maxDist = distance + range;

    // Filter shots by distance and start lie
    let filteredShots = shots.filter(shot => {
      const matchesDistance = shot.target >= minDist && shot.target <= maxDist;
      const matchesStartLie = startLie === 'all' || shot.startLie.toLowerCase().includes(startLie.toLowerCase());
      return matchesDistance && matchesStartLie;
    });

    // Further filter by desired end lie
    if (desiredEndLie === 'green') {
      filteredShots = filteredShots.filter(shot => {
        const endLieLower = shot.endLie?.toLowerCase() || '';
        return endLieLower.includes('green') || endLieLower.includes('fringe') || endLieLower.includes('hole') ||
               endLieLower.includes('fairway') || endLieLower.includes('rough') || // Include shots that didn't hit green but were trying
               (!endLieLower.includes('water') && !endLieLower.includes('ob') && !endLieLower.includes('penalty') && !endLieLower.includes('hazard'));
      });
    } else if (desiredEndLie === 'fairway') {
      filteredShots = filteredShots.filter(shot => {
        const endLieLower = shot.endLie?.toLowerCase() || '';
        return !endLieLower.includes('water') && !endLieLower.includes('ob') && !endLieLower.includes('penalty') && !endLieLower.includes('hazard');
      });
    } else if (desiredEndLie === 'any') {
      filteredShots = filteredShots.filter(shot => {
        const endLieLower = shot.endLie?.toLowerCase() || '';
        return !endLieLower.includes('water') && !endLieLower.includes('ob') && !endLieLower.includes('penalty') && !endLieLower.includes('hazard');
      });
    }

    // Total filtered shots for confidence calculation
    const totalFilteredShots = filteredShots.length;

    // Group by club
    const clubGroups: Record<string, typeof filteredShots> = {};
    filteredShots.forEach(shot => {
      const clubId = getClubConfigId(shot.club);
      if (!clubGroups[clubId]) clubGroups[clubId] = [];
      clubGroups[clubId].push(shot);
    });

    // Calculate metrics for each club
    const results: ClubResult[] = Object.entries(clubGroups).map(([clubId, clubShots]) => {
      const config = clubs.find(c => c.id === clubId);
      
      // Process shots
      const processed = clubShots.map(shot => processShot(shot, config, distanceToTargetTolerance));
      
      // Count good shots (≤10 handicap level)
      const goodShots = clubShots.filter(shot => GOOD_SHOT_LEVELS.includes(shot.shotQuality)).length;
      const goodShotPct = clubShots.length > 0 ? (goodShots / clubShots.length) * 100 : 0;
      
      // Calculate greens hit % (for green target only)
      const greenTargetShots = processed.filter(s => s.isTargetingGreen && !s.isBadMiss);
      const greensHit = greenTargetShots.filter(s => {
        const endLieLower = s.endLie?.toLowerCase() || '';
        return endLieLower.includes('green') || endLieLower.includes('fringe') || endLieLower.includes('hole');
      }).length;
      const greensHitPct = greenTargetShots.length > 0 ? (greensHit / greenTargetShots.length) * 100 : 0;
      
      // Average distance to target
      const distancesToTarget = processed
        .filter(s => s.distanceToTarget !== null)
        .map(s => Math.abs(s.distanceToTarget as number));
      const avgDistanceToTarget = distancesToTarget.length > 0 
        ? distancesToTarget.reduce((a, b) => a + b, 0) / distancesToTarget.length 
        : null;

      // Usage %: % of total shots at this distance that used this club
      const usagePct = totalFilteredShots > 0 ? (clubShots.length / totalFilteredShots) * 100 : 0;

      // Data Confidence based on sample size
      const getDataConfidence = (shots: number): 'high' | 'medium' | 'low' | 'very-low' => {
        if (shots >= 20) return 'high';
        if (shots >= 10) return 'medium';
        if (shots >= 5) return 'low';
        return 'very-low';
      };

      // Calculate shot confidence score
      const shotConfidence = calculateShotConfidence(
        goodShotPct,
        greensHitPct,
        avgDistanceToTarget
      );

      return {
        club: clubId,
        clubName: config?.clubName || clubShots[0]?.club || clubId,
        goodShotPct,
        totalShots: clubShots.length,
        usagePct,
        dataConfidence: getDataConfidence(clubShots.length),
        avgDistanceToTarget,
        greensHitPct,
        shotConfidence,
      };
    });

    // Filter to only show clubs with 40%+ confidence, then sort by shot confidence descending
    return results
      .filter(r => r.shotConfidence >= 40)
      .sort((a, b) => b.shotConfidence - a.shotConfidence);
  }, [shots, clubs, targetDistance, distanceRange, startLie, desiredEndLie, distanceToTargetTolerance]);

  const getDataConfidenceBadge = (confidence: 'high' | 'medium' | 'low' | 'very-low', shotCount: number) => {
    switch (confidence) {
      case 'high':
        return <Badge variant="default" className="bg-green-600">{shotCount} shots</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-amber-500 text-white">{shotCount} shots</Badge>;
      case 'low':
        return <Badge variant="outline" className="border-amber-500 text-amber-600">{shotCount} shots</Badge>;
      case 'very-low':
        return <Badge variant="outline" className="border-red-500 text-red-600">{shotCount} shots</Badge>;
    }
  };

  const getPercentageColor = (pct: number) => {
    if (pct >= 70) return 'text-green-600 font-bold';
    if (pct >= 50) return 'text-amber-600 font-semibold';
    return 'text-muted-foreground';
  };

  const getShotConfidenceBadge = (score: number) => {
    if (score >= 70) return <Badge variant="default" className="bg-green-600 text-lg font-bold px-3">{score}</Badge>;
    if (score >= 50) return <Badge variant="secondary" className="bg-amber-500 text-white text-lg font-bold px-3">{score}</Badge>;
    if (score >= 30) return <Badge variant="outline" className="border-amber-500 text-amber-600 text-lg font-bold px-3">{score}</Badge>;
    return <Badge variant="outline" className="border-red-500 text-red-600 text-lg font-bold px-3">{score}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Input Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Club Selector
          </CardTitle>
          <CardDescription>
            Find the best club for your situation based on historical performance data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Distance to Hole */}
            <div className="space-y-2">
              <Label htmlFor="target-distance">Distance to Hole (m)</Label>
              <Input
                id="target-distance"
                type="number"
                value={targetDistance}
                onChange={(e) => setTargetDistance(e.target.value)}
                placeholder="120"
                min="0"
                max="300"
              />
            </div>

            {/* Distance Range (+/-) */}
            <div className="space-y-2">
              <Label htmlFor="distance-range">Range (+/- m)</Label>
              <Input
                id="distance-range"
                type="number"
                value={distanceRange}
                onChange={(e) => setDistanceRange(e.target.value)}
                placeholder="10"
                min="0"
                max="50"
              />
            </div>

            {/* Start Lie */}
            <div className="space-y-2">
              <Label htmlFor="start-lie">Starting Lie</Label>
              <Select value={startLie} onValueChange={setStartLie}>
                <SelectTrigger id="start-lie">
                  <SelectValue placeholder="Select lie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Lies</SelectItem>
                  {availableStartLies.map(lie => (
                    <SelectItem key={lie} value={lie.toLowerCase()}>{lie}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Desired End Lie */}
            <div className="space-y-2">
              <Label htmlFor="end-lie">Target</Label>
              <Select value={desiredEndLie} onValueChange={setDesiredEndLie}>
                <SelectTrigger id="end-lie">
                  <SelectValue placeholder="Select target" />
                </SelectTrigger>
                <SelectContent>
                  {endLieOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Situation Summary */}
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Scenario:</span> I'm{' '}
              <span className="font-semibold text-primary">{targetDistance || '?'}m</span> out
              {startLie !== 'all' && <> from the <span className="font-semibold text-primary">{startLie}</span></>}
              , looking to hit the{' '}
              <span className="font-semibold text-primary">
                {desiredEndLie === 'green' ? 'green' : desiredEndLie === 'fairway' ? 'fairway' : 'target'}
              </span>.
              Which club has historically performed best?
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Results Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recommended Clubs
          </CardTitle>
          <CardDescription>
            Ranked by Shot Confidence score (weighted combination of all factors)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clubResults.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No shot data found for this scenario.</p>
              <p className="text-sm mt-1">Try adjusting the distance range or removing filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Club</TableHead>
                  <TableHead className="text-center">Shot Confidence</TableHead>
                  <TableHead className="text-right">Success %</TableHead>
                  <TableHead className="text-right">Greens Hit %</TableHead>
                  <TableHead className="text-right">Avg. Proximity</TableHead>
                  <TableHead className="text-right">Data Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clubResults.map((result, index) => (
                  <TableRow key={result.club} className={index === 0 ? 'bg-primary/5' : ''}>
                    <TableCell className="font-bold">
                      {index === 0 ? (
                        <Badge className="bg-primary">Best</Badge>
                      ) : (
                        <span className="text-muted-foreground">#{index + 1}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{result.clubName}</TableCell>
                    <TableCell className="text-center">
                      {getShotConfidenceBadge(result.shotConfidence)}
                    </TableCell>
                    <TableCell className={`text-right ${getPercentageColor(result.goodShotPct)}`}>
                      {result.goodShotPct.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {result.greensHitPct > 0 ? `${result.greensHitPct.toFixed(1)}%` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {result.avgDistanceToTarget !== null ? `${result.avgDistanceToTarget.toFixed(1)}m` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {getDataConfidenceBadge(result.dataConfidence, result.totalShots)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      {clubResults.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <span className="font-semibold text-foreground">Shot Confidence (0-100):</span> Weighted score combining Success % (50%), Greens Hit % (30%), and Proximity (20%)
              </div>
              <div className="flex flex-wrap gap-4">
                <span className="font-semibold">Shot Confidence:</span>
                <div className="flex items-center gap-1">
                  <Badge variant="default" className="bg-green-600 text-xs">≥70</Badge>
                  <span>High</span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="bg-amber-500 text-white text-xs">50-69</Badge>
                  <span>Medium</span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">30-49</Badge>
                  <span>Low</span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="border-red-500 text-red-600 text-xs">&lt;30</Badge>
                  <span>Very Low</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <span className="font-semibold">Data Confidence (sample size):</span>
                <div className="flex items-center gap-1">
                  <Badge variant="default" className="bg-green-600 text-xs">≥20</Badge>
                  <span>High</span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="bg-amber-500 text-white text-xs">10-19</Badge>
                  <span>Medium</span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">5-9</Badge>
                  <span>Low</span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="border-red-500 text-red-600 text-xs">&lt;5</Badge>
                  <span>Very Low</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
