import type { ShotsBySession } from '@/hooks/usePracticeShotsBySessions';
import { calculateShotDamage, describeHandicapEquivalent, shotConfidence, shotQualityScore, type AnalysisConfidence } from '@/lib/analysisSynthesis';
import { buildClubGappingRows, getShotLabel, visibleProfileId, type ShotCategoryOverrides, type ShotContext } from '@/lib/gapping';
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

export interface DistancePriority {
  distanceKey: string;
  distanceLabel: string;
  courseShotCount: number;
  reliancePerRound: number;
  sqi: number | null;
  badMissPct: number;
  damagePerRound: number;
  courseImpactScore: number;
  confidence: AnalysisConfidence;
  topClubShot: string;
  recommendation: string;
  evidence: string;
}

export interface CapabilityIndex {
  score: number | null;
  optionCount: number;
  provisionalOptionCount: number;
  shotCount: number;
  totalUsesPerRound: number;
  weakestOption: {
    configKey: string;
    clubShot: string;
    score: number;
    usesPerRound: number;
  } | null;
}

interface BuildPracticePrioritiesInput {
  shots: Shot[];
  profiles: ShotProfileMap;
  practiceSessions: PracticeSession[];
  practiceConfigs: ClubPracticeConfig[];
  shotsBySession: ShotsBySession;
  gappingReliablePercent: number;
  shotCategoryOverrides?: ShotCategoryOverrides;
  shotClassificationRules?: ShotClassificationRules;
  perConfigShotLimit?: number | null;
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

function mapShotsToConfigs({
  shots,
  profiles,
  practiceSessions,
  practiceConfigs,
  shotsBySession,
  gappingReliablePercent,
  shotCategoryOverrides = {},
  shotClassificationRules,
}: BuildPracticePrioritiesInput): Map<string, string> {
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
      gappingReliablePercent,
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
  return shotToConfig;
}

export function buildPracticePriorities({
  shots,
  profiles,
  practiceSessions,
  practiceConfigs,
  shotsBySession,
  gappingReliablePercent,
  shotCategoryOverrides = {},
  shotClassificationRules,
  perConfigShotLimit = 20,
}: BuildPracticePrioritiesInput): PracticePriority[] {
  const shotToConfig = mapShotsToConfigs({
    shots, profiles, practiceSessions, practiceConfigs, shotsBySession, gappingReliablePercent, shotCategoryOverrides, shotClassificationRules,
  });

  const grouped = new Map<string, Shot[]>();
  for (const shot of shots) {
    const configKey = shotToConfig.get(shot.id) ?? fallbackConfigKey(shot);
    if (!configKey) continue;
    grouped.set(configKey, [...(grouped.get(configKey) ?? []), shot]);
  }
  const roundCount = new Set(shots.map((shot) => getShotDateKey(shot.date))).size;

  return [...grouped.entries()].map(([configKey, configShots]) => {
    const profile = profileForKey(configKey, profiles);
    const sortedConfigShots = [...configShots].sort((a, b) => b.date.getTime() - a.date.getTime());
    const recent = perConfigShotLimit === null ? sortedConfigShots : sortedConfigShots.slice(0, perConfigShotLimit);
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

export function buildCapabilityIndex(input: BuildPracticePrioritiesInput): CapabilityIndex {
  const { shots, profiles } = input;
  const shotToConfig = mapShotsToConfigs(input);
  const grouped = new Map<string, { scores: number[]; uses: number }>();
  const roundCount = new Set(shots.map((shot) => getShotDateKey(shot.date))).size;

  for (const shot of shots) {
    const score = shotQualityScore(shot.shotQuality);
    const configKey = shotToConfig.get(shot.id) ?? fallbackConfigKey(shot);
    if (!configKey) continue;
    const current = grouped.get(configKey) ?? { scores: [], uses: 0 };
    grouped.set(configKey, {
      scores: score === null ? current.scores : [...current.scores, score],
      uses: current.uses + 1,
    });
  }

  const allOptions = [...grouped.entries()].map(([configKey, group]) => {
    const topThree = [...group.scores].sort((a, b) => b - a).slice(0, 3);
    const profile = profileForKey(configKey, profiles);
    const clubName = PRACTICE_CLUBS.find((club) => club.id === profile.clubId)?.name ?? profile.clubId;
    return {
      configKey,
      clubShot: `${clubName} · ${getShotLabel(profile)}`,
      score: Math.round(mean(topThree) ?? 0),
      shotCount: topThree.length,
      usesPerRound: roundCount ? group.uses / roundCount : 0,
    };
  });
  const options = allOptions.filter((option) => option.shotCount >= 3);
  const weakestOption = [...options].sort((a, b) => a.score - b.score)[0] ?? null;
  const totalUsesPerRound = options.reduce((sum, option) => sum + option.usesPerRound, 0);
  const weightedScore = totalUsesPerRound
    ? options.reduce((sum, option) => sum + option.score * option.usesPerRound, 0) / totalUsesPerRound
    : null;

  return {
    score: weightedScore === null ? null : Math.round(weightedScore),
    optionCount: options.length,
    provisionalOptionCount: allOptions.length - options.length,
    shotCount: options.reduce((sum, option) => sum + option.shotCount, 0),
    totalUsesPerRound: round(totalUsesPerRound),
    weakestOption: weakestOption ? {
      configKey: weakestOption.configKey,
      clubShot: weakestOption.clubShot,
      score: weakestOption.score,
      usesPerRound: round(weakestOption.usesPerRound),
    } : null,
  };
}

function distanceBand(target: number): { key: string; label: string } | null {
  if (!Number.isFinite(target) || target <= 0 || target > 150) return null;
  if (target > 100) return { key: '100-150', label: '100–150m' };
  const upper = Math.ceil(target / 10) * 10;
  const lower = Math.max(0, upper - 10);
  return { key: `${lower}-${upper}`, label: `${lower}–${upper}m` };
}

export function buildDistancePriorities({
  shots,
  profiles,
  practiceSessions,
  practiceConfigs,
  shotsBySession,
  gappingReliablePercent,
  shotCategoryOverrides = {},
  shotClassificationRules,
}: BuildPracticePrioritiesInput): DistancePriority[] {
  const shotToConfig = mapShotsToConfigs({
    shots, profiles, practiceSessions, practiceConfigs, shotsBySession, gappingReliablePercent, shotCategoryOverrides, shotClassificationRules,
  });

  const grouped = new Map<string, { band: { key: string; label: string }; shots: Shot[] }>();
  for (const shot of shots) {
    const band = distanceBand(shot.target);
    if (!band) continue;
    const current = grouped.get(band.key) ?? { band, shots: [] };
    current.shots.push(shot);
    grouped.set(band.key, current);
  }

  const roundCount = new Set(shots.map((shot) => getShotDateKey(shot.date))).size;
  return [...grouped.values()].map(({ band, shots: bandShots }) => {
    const qualityScores = bandShots.map((shot) => shotQualityScore(shot.shotQuality)).filter((value): value is number => value !== null);
    const sqi = mean(qualityScores);
    const badMisses = bandShots.filter((shot) => calculateShotDamage(shot) >= 1).length;
    const totalDamage = bandShots.reduce((sum, shot) => sum + calculateShotDamage(shot), 0);
    const reliancePerRound = roundCount ? bandShots.length / roundCount : 0;
    const badMissPct = bandShots.length ? (badMisses / bandShots.length) * 100 : 0;
    const damagePerShot = bandShots.length ? totalDamage / bandShots.length : 0;
    const qualityWeakness = sqi === null ? 0.25 : clamp((90 - sqi) / 65);
    const missCost = clamp((badMissPct / 100) + (damagePerShot / 2), 0, 1.5);
    const courseImpactScore = reliancePerRound * (qualityWeakness + missCost);

    const optionGroups = new Map<string, Shot[]>();
    for (const shot of bandShots) {
      const configKey = shotToConfig.get(shot.id) ?? fallbackConfigKey(shot) ?? getClubConfigId(shot.club);
      optionGroups.set(configKey, [...(optionGroups.get(configKey) ?? []), shot]);
    }
    const [topConfigKey, topOptionShots] = [...optionGroups.entries()].sort((a, b) => {
      const optionImpact = (entry: [string, Shot[]]) => entry[1].reduce((sum, shot) => sum + calculateShotDamage(shot) + (shotQualityScore(shot.shotQuality) === null ? 0 : (90 - (shotQualityScore(shot.shotQuality) ?? 90)) / 65), 0);
      return optionImpact(b) - optionImpact(a);
    })[0] ?? ['', []];
    const topProfile = profileForKey(topConfigKey, profiles);
    const topClubName = PRACTICE_CLUBS.find((club) => club.id === topProfile.clubId)?.name ?? topOptionShots[0]?.club ?? topProfile.clubId;
    const topClubShot = `${topClubName} · ${getShotLabel(topProfile)}`;

    return {
      distanceKey: band.key,
      distanceLabel: band.label,
      courseShotCount: bandShots.length,
      reliancePerRound: round(reliancePerRound),
      sqi: sqi === null ? null : Math.round(sqi),
      badMissPct: Math.round(badMissPct),
      damagePerRound: round(roundCount ? totalDamage / roundCount : 0),
      courseImpactScore: round(courseImpactScore, 3),
      confidence: shotConfidence(bandShots.length),
      topClubShot,
      recommendation: `Practise ${topClubShot.toLowerCase()} for ${band.label} approaches, prioritising playable contact and distance control.`,
      evidence: `${bandShots.length} shots · ${round(reliancePerRound)} uses/round · SQI ${sqi === null ? '-' : Math.round(sqi)} · ${Math.round(badMissPct)}% costly misses`,
    };
  }).sort((a, b) => b.courseImpactScore - a.courseImpactScore);
}
