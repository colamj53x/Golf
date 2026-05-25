import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquareText, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ClubRatings, getRatingColor, getImprovementDisplay } from '@/lib/clubRatings';
import { ClubAnalysis, generateSummaryParagraph } from '@/lib/clubSummaryGenerator';

interface MetricData {
  onTargetPct: number;
  rightPct: number;
  leftPct: number;
  shortPct: number;
  badMissPct: number;
  avgDistanceHit: number;
  distanceVariation: number;
  sideVariation: number;
  greensHitPct: number;
  strikeCentrePct: number;
  avgDistanceToTarget: number | null;
  proximityWithin5mPct: number;
  proximityWithin10mPct?: number;
  shotCount: number;
}

interface QuartileData {
  top25: MetricData;
  top50: MetricData;
  top75: MetricData;
  top100: MetricData;
}

interface ClubSummaryCardProps {
  clubName: string;
  analysis: ClubAnalysis;
  ratings: ClubRatings;
  shotCount: number;
  overall?: MetricData;
  quartiles?: QuartileData;
  distanceToTargetEnabled?: boolean;
}

export function ClubSummaryCard({ 
  clubName, 
  analysis, 
  ratings, 
  shotCount,
  overall,
  quartiles,
  distanceToTargetEnabled
}: ClubSummaryCardProps) {
  const summary = generateSummaryParagraph(
    analysis, 
    ratings, 
    clubName, 
    shotCount,
    overall,
    quartiles,
    distanceToTargetEnabled
  );
  const improvementDisplay = getImprovementDisplay(ratings.improvement);

  const TrendIcon = ratings.improvementDirection === 'improving' 
    ? TrendingUp 
    : ratings.improvementDirection === 'declining' 
      ? TrendingDown 
      : Minus;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquareText className="h-5 w-5 text-primary" />
          Performance Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ratings Overview */}
        <div className="grid grid-cols-4 gap-4 pb-4 border-b border-border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Capability</p>
            <p className={`text-xl font-bold ${getRatingColor(ratings.capability)}`}>
              {ratings.capability}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Consistency</p>
            <p className={`text-xl font-bold ${getRatingColor(ratings.consistency)}`}>
              {ratings.consistency}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Current Form</p>
            <p className={`text-xl font-bold ${getRatingColor(ratings.currentForm)}`}>
              {ratings.currentForm}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Trend</p>
            <div className={`flex items-center justify-center gap-1 ${improvementDisplay.color}`}>
              <TrendIcon className="h-4 w-4" />
              <span className="text-sm font-semibold">{ratings.improvement >= 0 ? '+' : ''}{ratings.improvement}</span>
            </div>
          </div>
        </div>

        {/* Summary Text */}
        <p className="text-sm leading-relaxed text-foreground">
          {summary}
        </p>

        {/* Quick Stats */}
        <div className="flex flex-wrap gap-2 pt-2">
          {analysis.improvements.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-600 dark:text-green-400 text-xs rounded-full">
              <TrendingUp className="h-3 w-3" />
              {analysis.improvements.length} improving
            </span>
          )}
          {analysis.weaknesses.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs rounded-full">
              {analysis.weaknesses.length} area{analysis.weaknesses.length > 1 ? 's' : ''} to work on
            </span>
          )}
          <span className="inline-flex items-center px-2 py-1 bg-muted text-muted-foreground text-xs rounded-full">
            Based on {shotCount} shots
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
