import { ClubRatings } from './clubRatings';

export interface ClubAnalysis {
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  recommendations: string[];
}

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

interface TrendData {
  mostRecent: MetricData;
  middle: MetricData;
  oldest: MetricData;
}

interface QuartileData {
  top25: MetricData;
  top50: MetricData;
  top75: MetricData;
  top100: MetricData;
}

export function analyzeClubPerformance(
  overall: MetricData,
  trend: TrendData,
  ratings: ClubRatings,
  clubName: string,
  distanceToTargetEnabled: boolean,
  quartiles?: QuartileData
): ClubAnalysis {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const improvements: string[] = [];
  const recommendations: string[] = [];

  // Analyze accuracy
  if (overall.onTargetPct >= 70) {
    strengths.push('excellent accuracy');
  } else if (overall.onTargetPct >= 50) {
    strengths.push('solid accuracy');
  } else if (overall.onTargetPct < 40) {
    weaknesses.push('inconsistent accuracy');
    recommendations.push('Focus on alignment and swing path to improve directional control');
  }

  // Analyze bad misses
  if (overall.badMissPct <= 5) {
    strengths.push('minimal disaster shots');
  } else if (overall.badMissPct > 15) {
    weaknesses.push('too many penalty situations');
    recommendations.push('Consider playing more conservatively to avoid high-risk misses');
  }

  // Analyze distance consistency
  if (overall.distanceVariation <= 8) {
    strengths.push('consistent distance control');
  } else if (overall.distanceVariation > 15) {
    weaknesses.push('unpredictable distances');
    recommendations.push('Work on tempo and strike quality for more predictable yardages');
  }

  // Analyze dispersion
  if (overall.sideVariation <= 6) {
    strengths.push('tight dispersion');
  } else if (overall.sideVariation > 12) {
    weaknesses.push('wide dispersion pattern');
    recommendations.push('Practice with alignment aids to tighten your shot pattern');
  }

  // Analyze miss pattern
  if (overall.rightPct > 35 && overall.rightPct > overall.leftPct * 1.5) {
    weaknesses.push('tendency to miss right');
    recommendations.push('Check your grip and clubface alignment at address');
  } else if (overall.leftPct > 35 && overall.leftPct > overall.rightPct * 1.5) {
    weaknesses.push('tendency to miss left');
    recommendations.push('Focus on your swing path through impact');
  }

  // Analyze short shots
  if (overall.shortPct > 25) {
    weaknesses.push('leaving shots short too often');
    recommendations.push('Trust your numbers and commit fully to your club selection');
  } else if (overall.shortPct <= 10) {
    strengths.push('good commitment to distances');
  }

  // Analyze strike quality
  if (overall.strikeCentrePct >= 70) {
    strengths.push('pure ball striking');
  } else if (overall.strikeCentrePct < 50) {
    weaknesses.push('inconsistent strike quality');
    recommendations.push('Slow down your backswing and focus on solid contact');
  }

  // Analyze green metrics if applicable
  if (distanceToTargetEnabled) {
    if (overall.greensHitPct >= 65) {
      strengths.push('reliable green hitting');
    } else if (overall.greensHitPct < 40) {
      weaknesses.push('difficulty finding greens');
    }

    if (overall.proximityWithin5mPct >= 50) {
      strengths.push('excellent proximity to the hole');
    } else if (overall.proximityWithin5mPct < 25 && overall.avgDistanceToTarget !== null) {
      weaknesses.push('leaving approach shots too far from the pin');
      recommendations.push('Aim for the middle of greens and let your accuracy improve over time');
    }
  }

  // Analyze trends - check for improvements
  const recentVsOldest = {
    onTarget: trend.mostRecent.onTargetPct - trend.oldest.onTargetPct,
    badMiss: trend.mostRecent.badMissPct - trend.oldest.badMissPct,
    strikeCentre: trend.mostRecent.strikeCentrePct - trend.oldest.strikeCentrePct,
    sideVariation: trend.mostRecent.sideVariation - trend.oldest.sideVariation,
  };

  if (recentVsOldest.onTarget > 10) {
    improvements.push('accuracy has improved significantly');
  }
  if (recentVsOldest.badMiss < -5) {
    improvements.push('fewer disaster shots recently');
  }
  if (recentVsOldest.strikeCentre > 10) {
    improvements.push('strike quality is trending up');
  }
  if (recentVsOldest.sideVariation < -3) {
    improvements.push('dispersion is tightening');
  }

  // Check for declining trends
  if (recentVsOldest.onTarget < -10) {
    weaknesses.push('accuracy has dropped recently');
  }
  if (recentVsOldest.badMiss > 5) {
    weaknesses.push('more penalty situations lately');
  }

  // Rating-based insights
  if (ratings.capability >= 80 && ratings.consistency < 60) {
    recommendations.push('You have elite potential with this club—focus on consistency to unlock it');
  }
  if (ratings.currentForm > ratings.consistency + 10) {
    improvements.push('current form is above your average');
  } else if (ratings.currentForm < ratings.consistency - 10) {
    weaknesses.push('recent performance below your typical level');
  }

  return { strengths, weaknesses, improvements, recommendations };
}

export function generateSummaryParagraph(
  analysis: ClubAnalysis,
  ratings: ClubRatings,
  clubName: string,
  shotCount: number,
  overall?: MetricData,
  quartiles?: QuartileData,
  distanceToTargetEnabled?: boolean
): string {
  const parts: string[] = [];
  const overallRating = Math.round((ratings.capability + ratings.consistency) / 2);

  // Blunt opening assessment
  if (overallRating >= 75) {
    parts.push(`${clubName} is performing well (${overallRating}/100 overall from ${shotCount} shots).`);
  } else if (overallRating >= 55) {
    parts.push(`${clubName} is serviceable but has clear gaps (${overallRating}/100 from ${shotCount} shots).`);
  } else {
    parts.push(`${clubName} needs work—${overallRating}/100 overall from ${shotCount} shots is below standard.`);
  }

  // Capability vs consistency gap
  if (ratings.capability > ratings.consistency + 15) {
    parts.push(`Your capability (${ratings.capability}) far exceeds your consistency (${ratings.consistency}). You can hit good shots, but you can't repeat them.`);
  } else if (ratings.consistency > ratings.capability + 10) {
    parts.push(`Consistency (${ratings.consistency}) beats capability (${ratings.capability})—you're repeatable but your ceiling is low.`);
  }

  // Quartile analysis - the key insight
  if (quartiles) {
    const top25Accuracy = quartiles.top25.onTargetPct;
    const top100Accuracy = quartiles.top100.onTargetPct;
    const dropOff = Math.round(top25Accuracy - top100Accuracy);
    
    if (dropOff > 20) {
      parts.push(`Quartile breakdown shows a ${dropOff}% accuracy drop from your best 25% to all shots—your bad swings are hurting you significantly.`);
    } else if (dropOff < 10) {
      parts.push(`Only ${dropOff}% accuracy difference between your top 25% and overall—you're consistent across all shot quality tiers.`);
    }

    // Compare top 25 strike quality to overall
    if (quartiles.top25.strikeCentrePct > (overall?.strikeCentrePct || 0) + 15) {
      parts.push(`Your top quartile has ${Math.round(quartiles.top25.strikeCentrePct)}% centre strikes vs ${Math.round(overall?.strikeCentrePct || 0)}% overall—when you're focused, your contact is much better.`);
    }
  }

  // Strike quality assessment
  if (overall) {
    if (overall.strikeCentrePct < 50) {
      parts.push(`Strike Centre at ${Math.round(overall.strikeCentrePct)}% is poor—less than half your shots are pure contact. This affects every other metric.`);
    } else if (overall.strikeCentrePct >= 70) {
      parts.push(`Strike Centre at ${Math.round(overall.strikeCentrePct)}% is strong—solid contact is not your issue.`);
    } else {
      parts.push(`Strike Centre at ${Math.round(overall.strikeCentrePct)}%—room for improvement in contact quality.`);
    }
  }

  // Green and proximity metrics
  if (distanceToTargetEnabled && overall) {
    if (overall.greensHitPct < 40) {
      parts.push(`Greens Hit at ${Math.round(overall.greensHitPct)}% is too low—you're scrambling too often.`);
    } else if (overall.greensHitPct >= 65) {
      parts.push(`Greens Hit at ${Math.round(overall.greensHitPct)}% is solid green-finding.`);
    }

    if (overall.avgDistanceToTarget !== null) {
      if (overall.avgDistanceToTarget > 12) {
        parts.push(`Average proximity of ${overall.avgDistanceToTarget.toFixed(1)}m leaves long putts. Only ${Math.round(overall.proximityWithin5mPct)}% finish within 5m.`);
      } else if (overall.proximityWithin5mPct >= 40) {
        parts.push(`${Math.round(overall.proximityWithin5mPct)}% within 5m is good proximity—you're giving yourself birdie looks.`);
      } else {
        parts.push(`Proximity: ${Math.round(overall.proximityWithin5mPct)}% within 5m, averaging ${overall.avgDistanceToTarget.toFixed(1)}m from the pin.`);
      }
    }
  }

  // Strengths - brief
  if (analysis.strengths.length > 0) {
    parts.push(`Strengths: ${analysis.strengths.join(', ')}.`);
  }

  // Weaknesses - direct
  if (analysis.weaknesses.length > 0) {
    parts.push(`Problems: ${analysis.weaknesses.join(', ')}.`);
  }

  // Trend
  if (analysis.improvements.length > 0) {
    parts.push(`Trending better: ${analysis.improvements.join(', ')}.`);
  } else if (ratings.improvementDirection === 'declining') {
    parts.push(`Form is declining. Check your fundamentals.`);
  }

  // Recommendations
  if (analysis.recommendations.length > 0) {
    parts.push(`Focus on: ${analysis.recommendations.join(' ')}`);
  }

  return parts.join(' ');
}
