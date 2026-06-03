import type { ShotsBySession } from '@/hooks/usePracticeShotsBySessions';
import { calculateShotDamage, describeHandicapEquivalent, shotConfidence, shotQualityScore, type AnalysisConfidence } from '@/lib/analysisSynthesis';
import { buildClubGappingRows, getShotLabel, loadShotCategoryOverrides, visibleProfileId, type ShotCategoryOverrides, type ShotContext } from '@/lib/gapping';
import { getClubConfigId, getShotDateKey } from '@/lib/golfCalculations';
import type { ShotClassificationRules } from '@/lib/shotClassificationRules';
import type { ShotProfile, ShotProfileMap } from '@/lib/shotProfiles';
import type { Shot } from '@/types/golf';
import type { ClubPracticeConfig, PracticeSession } from '@/types/practice';
import { PRACTICE_CLUBS, parsePracticeConfigKey } from '@/types/practiceClubs';

export interface PracticePriority {
  configKey: string;
  clubId: string;
  clubName: string;
  shotType: string;
  power: string;
  shotLabel: string;
  courseShotCount: number;
  reliancePerRound: number;
  sqi: number | null;
  handicapEquivalent: string;
  badMissPct: number;
  damagePerRound: number;
  courseImpactScore: number;
  confidence: AnalysisConfidence;
  recommendation: string;
  evidence: string;
}

interface BuildPracticePrioritiesInput {
  shots: Shot[];
  profiles: ShotProfileMap;
  practiceSessions: PracticeSession[];
  practiceConfigs: ClubPracticeConfig[];
  shotsBySession: ShotsBySession;
  gappingHcpTarget: number;
  shotCategoryOverrides?: ShotCategoryOverrides;
  shotClassificationRules?: ShotClassificationRules;
}

const round = (value: number, digits = 1) => Math.round(value * (10 ** digits)) / (10 ** digits);
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

function fallbackConfigKey(shot: Shot): string | null {
  const clubId = getClubConfigId(shot.club);
  return PRACTICE_CLUBS.some((club) => club.id === clubId) ? `${clubId}_full_full` : null;
}

function profileForKey(configKey: string, profiles: ShotProfileMap): ShotProfile {
  const parsed = parsePracticeConfigKey(configKey);
  return profiles[configKey] ?? {
    id: configKey,
    clubId: parsed.club,
    shotType: parsed.shotType,
    power: parsed.power,
    enabled: true,
    showInPractice: true,
    showOnCourse: true,
    targets: ['green'],
    technique: '',
    routine: '',
    targetTotal: null,
    targetCarry: null,
    targetSideLeft: null,
    targetSideRight: null,
    targetVariationPct: null,
    targetQualityCutoff: null,
    targetOverrides: {},
  };
}

function recommendationFor(priority: Pick<PracticePriority, 'clubName' | 'shotLabel' | 'badMissPct' | 'sqi' | 'reliancePerRound'>): string {
  const shot = `${priority.clubName} ${priority.shotLabel.toLowerCase()}`;
  if (priority.badMissPct >= 20) return `Reduce costly misses with ${shot} before chasing extra distance.`;
  if ((priority.sqi ?? 100) < 60) return `Build a more playable stock pattern with ${shot}.`;
  if (priority.reliancePerRound >= 1) return `Tighten the repeatability of ${shot}; it appears often enough to affect scoring.`;
  return `Monitor ${shot} and add focused reps when it enters the next practice block.`;
}

export function buildPracticePriorities({
  shots,
  profiles,
  practiceSessions,
  practiceConfigs,
  shotsBySession,
  gappingHcpTarget,
  shotCategoryOverrides = loadShotCategoryOverrides(),
  shotClassificationRules,
}: BuildPracticePrioritiesInput): PracticePriority[] {
  const shotToConfig = new Map<string, string>();
  const contexts: ShotContext[] = ['tee', 'fairway', 'roughRecovery'];

  for (const shotContext of contexts) {
    const rows = buildClubGappingRows({
      profiles,
      shots,
      shotContext,
      practiceSessions,
      practiceConfigs,
      shotsBySession,
      gappingHcpTarget,
      shotCategoryOverrides,
      shotClassificationRules,
    });
    for (const row of rows) {
      const configKey = visibleProfileId(row.profile.id);
      for (const shot of row.sample) {
        if (!shotToConfig.has(shot.id)) shotToConfig.set(shot.id, configKey);
      }
    }
  }

  const grouped = new Map<string, Shot[]>();
  for (const shot of shots) {
    const configKey = shotToConfig.get(shot.id) ?? fallbackConfigKey(shot);
    if (!configKey) continue;
    grouped.set(configKey, [...(grouped.get(configKey) ?? []), shot]);
  }
  const roundCount = new Set(shots.map((shot) => getShotDateKey(shot.date))).size;

  return [...grouped.entries()].map(([configKey, configShots]) => {
    const profile = profileForKey(configKey, profiles);
    const recent = [...configShots].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 20);
    const qualityScores = recent.map((shot) => shotQualityScore(shot.shotQuality)).filter((value): value is number => value !== null);
    const sqi = mean(qualityScores);
    const badMisses = recent.filter((shot) => calculateShotDamage(shot) >= 1).length;
    const totalDamage = recent.reduce((sum, shot) => sum + calculateShotDamage(shot), 0);
    const reliancePerRound = roundCount ? configShots.length / roundCount : 0;
    const badMissPct = recent.length ? (badMisses / recent.length) * 100 : 0;
    const damagePerShot = recent.length ? totalDamage / recent.length : 0;
    const qualityWeakness = sqi === null ? 0.25 : clamp((90 - sqi) / 65);
    const missCost = clamp((badMissPct / 100) + (damagePerShot / 2), 0, 1.5);
    const courseImpactScore = reliancePerRound * (qualityWeakness + missCost);
    const base = {
      configKey,
      clubId: profile.clubId,
      clubName: PRACTICE_CLUBS.find((club) => club.id === profile.clubId)?.name ?? profile.clubId,
      shotType: profile.shotType,
      power: profile.power,
      shotLabel: getShotLabel(profile),
      courseShotCount: configShots.length,
      reliancePerRound: round(reliancePerRound),
      sqi: sqi === null ? null : Math.round(sqi),
      handicapEquivalent: describeHandicapEquivalent(sqi),
      badMissPct: Math.round(badMissPct),
      damagePerRound: round(roundCount ? totalDamage / roundCount : 0),
      courseImpactScore: round(courseImpactScore, 3),
      confidence: shotConfidence(configShots.length),
    };
    return {
      ...base,
      recommendation: recommendationFor(base),
      evidence: `${base.reliancePerRound.toFixed(1)} uses/round · SQI ${base.sqi ?? '-'} (${base.handicapEquivalent}) · ${base.badMissPct}% costly misses`,
    };
  }).sort((a, b) => b.courseImpactScore - a.courseImpactScore);
}
