import type { ClubConfig, RoundReflection, Shot } from '@/types/golf';
import type { PracticeSession } from '@/types/practice';
import { parsePracticeConfigKey } from '@/types/practiceClubs';

export type AnalysisConfidence = 'high' | 'medium' | 'low' | 'none';
export type AnalysisTrend = 'improving' | 'stable' | 'declining' | 'volatile' | 'insufficient';
export type TransferStatus = 'transferring' | 'not-yet-transferring' | 'course-better' | 'insufficient';
export type DamageSeverity = 'low' | 'medium' | 'high' | 'severe';

export interface AnalysisPuttingSession {
  sessionDate: string;
  totalScore: number;
  maxTotal: number;
  notes: string;
  mainMiss: string;
}

export interface ClubInsight {
  clubId: string;
  clubName: string;
  shots: number;
  sqi: number | null;
  recentSqi: number | null;
  baselineSqi: number | null;
  change: number | null;
  trend: AnalysisTrend;
  badMissPct: number;
  damage: number;
  damagePerShot: number;
  severity: DamageSeverity | null;
  direction: string;
  distance: string;
  tags: string[];
  commonEndLie: string;
  confidence: AnalysisConfidence;
  evidence: string;
  recommendation: string;
}

export interface PriorityInsight extends ClubInsight {
  rank: number;
}

export interface ReflectionTheme {
  id: string;
  label: string;
  count: number;
  confidence: AnalysisConfidence;
  linkedData: string;
  meaning: string;
}

export interface TransferInsight {
  clubName: string;
  status: TransferStatus;
  evidence: string;
  action: string;
  confidence: AnalysisConfidence;
}

export interface FormInsight {
  area: string;
  trend: AnalysisTrend;
  evidence: string;
  meaning: string;
  confidence: AnalysisConfidence;
}

export interface SqiSegment {
  id: string;
  label: string;
  rounds: number;
  sqi: number | null;
  handicapEquivalent: string;
  damagePerRound: number;
}

export interface AnalysisModel {
  sqi: number | null;
  baselineSqi: number | null;
  change: number | null;
  currentLevel: string;
  handicapEquivalent: string;
  trend: AnalysisTrend;
  shots: number;
  rounds: number;
  confidence: AnalysisConfidence;
  badMissPct: number;
  scoringDamage: number;
  damagePerRound: number;
  diagnosis: string;
  topLeak: string;
  priorities: PriorityInsight[];
  reliableClubs: ClubInsight[];
  clubInsights: ClubInsight[];
  formInsights: FormInsight[];
  transferInsights: TransferInsight[];
  reflectionThemes: ReflectionTheme[];
  reflectionSummary: string;
  chronologicalSqi: SqiSegment[];
  qualitySqi: SqiSegment[];
}

interface AnalysisInput {
  shots: Shot[];
  clubs: ClubConfig[];
  roundReflections: RoundReflection[];
  practiceSessions: PracticeSession[];
  puttingSessions?: AnalysisPuttingSession[];
}

const QUALITY_SCORES: Record<string, number> = {
  pro: 100,
  'elite am': 95,
  '0 handicap': 90,
  '5 handicap': 80,
  '10 handicap': 70,
  '15 handicap': 60,
  '20 handicap': 45,
  '25 handicap': 25,
};

const HANDICAP_BENCHMARKS = [
  { score: 90, handicap: 0 },
  { score: 80, handicap: 5 },
  { score: 70, handicap: 10 },
  { score: 60, handicap: 15 },
  { score: 45, handicap: 20 },
  { score: 25, handicap: 25 },
];

const TAGS = ['slice', 'push', 'pull', 'fade', 'draw', 'hook', 'straight', 'fat', 'thin', 'top', 'topped', 'high', 'low'];

const REFLECTION_THEMES = [
  { id: 'rushed', label: 'Rushed swing', patterns: ['rush', 'rushed', 'quick', 'tempo'], linkedData: 'Routine and tempo', meaning: 'Slow the pre-shot routine and make the first move deliberate.' },
  { id: 'tentative', label: 'Tentative swing', patterns: ['tentative', 'commit', 'confidence', "didn't trust", 'did not trust'], linkedData: 'Commitment', meaning: 'Build committed swings around a clear target and club choice.' },
  { id: 'fat', label: 'Fat iron strike', patterns: ['fat', 'heavy', 'chunk'], linkedData: 'Strike quality', meaning: 'Add low-point control work to the next practice block.' },
  { id: 'top', label: 'Topped shot', patterns: ['top', 'topped'], linkedData: 'Strike quality', meaning: 'Prioritise clean contact before adding speed or difficulty.' },
  { id: 'right', label: 'Right miss', patterns: ['slice', 'push', 'right miss', 'missed right'], linkedData: 'Direction pattern', meaning: 'Train a playable start line and reduce the damaging right miss.' },
  { id: 'putting-short', label: 'Leaving putts short', patterns: ['putt short', 'putts short', 'leaving putts short', 'speed control'], linkedData: 'Putting reflections', meaning: 'Add pace ladders and finish each putting block with pressure putts.' },
  { id: 'wrong-club', label: 'Wrong club selection', patterns: ['wrong club', 'club selection', "didn't trust club", 'did not trust club'], linkedData: 'Course management reflection', meaning: 'Use this as a reflection-backed course-management watchpoint.' },
  { id: 'risky', label: 'Risky shot choice', patterns: ['risky', 'hero shot', 'course management', 'bad target'], linkedData: 'Course management reflection', meaning: 'Review whether the safer play leaves a better next shot.' },
];

const roundDateKey = (shot: Shot) => shot.date.toISOString().slice(0, 10);
const round = (value: number) => Math.round(value);
const pct = (value: number) => Math.round(value * 100);
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const normalise = (value: string) => value.trim().toLowerCase();

export function shotQualityScore(value: string): number | null {
  return QUALITY_SCORES[normalise(value)] ?? null;
}

export function describeHandicapEquivalent(score: number | null): string {
  if (score === null) return 'Not enough data';
  if (score >= 100) return 'Pro quality';
  if (score >= 95) return 'Elite amateur quality';
  if (score >= 90) return 'Scratch quality';
  if (score < HANDICAP_BENCHMARKS[HANDICAP_BENCHMARKS.length - 1].score) return '25+ handicap quality';

  for (let index = 0; index < HANDICAP_BENCHMARKS.length - 1; index += 1) {
    const stronger = HANDICAP_BENCHMARKS[index];
    const weaker = HANDICAP_BENCHMARKS[index + 1];
    if (score <= stronger.score && score >= weaker.score) {
      const progress = (stronger.score - score) / (stronger.score - weaker.score);
      const handicap = stronger.handicap + progress * (weaker.handicap - stronger.handicap);
      return `~${round(handicap)} handicap quality`;
    }
  }

  return '25+ handicap quality';
}

export function shotConfidence(shots: number): AnalysisConfidence {
  if (shots >= 30) return 'high';
  if (shots >= 15) return 'medium';
  if (shots >= 8) return 'low';
  return 'none';
}

export function reflectionConfidence(mentions: number): AnalysisConfidence {
  if (mentions >= 4) return 'high';
  if (mentions >= 2) return 'medium';
  if (mentions >= 1) return 'low';
  return 'none';
}

function roundConfidence(rounds: number): AnalysisConfidence {
  if (rounds >= 5) return 'high';
  if (rounds >= 3) return 'medium';
  if (rounds >= 1) return 'low';
  return 'none';
}

function clubIdForShot(shot: Shot, clubs: ClubConfig[]): string {
  const candidate = normalise(shot.club).replace(/\s+/g, '');
  const direct = clubs.find((club) => normalise(club.id) === candidate);
  if (direct) return direct.id;
  const named = clubs.find((club) => normalise(club.clubName).replace(/\s+/g, '') === candidate);
  if (named) return named.id;
  if (candidate === 'driver' || candidate === 'dr') return 'dr';
  return candidate;
}

function scoreShotDamage(shot: Shot): { damage: number; severity: DamageSeverity | null } {
  const text = `${shot.endLie} ${shot.notes} ${shot.strikeQuality}`.toLowerCase();
  if (/(penalty|lost|water|ob|out of bounds|unplayable)/.test(text)) return { damage: 2, severity: 'severe' };
  if (/(recovery|trees|tree|bush|blocked|hazard)/.test(text)) return { damage: 1.5, severity: 'high' };
  if (/(top|topped|fat|chunk|heavy)/.test(text)) return { damage: 1, severity: 'medium' };
  if (/(rough|bunker|sand|thin)/.test(text)) return { damage: 0.25, severity: 'low' };
  return { damage: 0, severity: null };
}

const severityRank: Record<DamageSeverity, number> = { low: 1, medium: 2, high: 3, severe: 4 };

function highestSeverity(shots: Shot[]): DamageSeverity | null {
  return shots.reduce<DamageSeverity | null>((highest, shot) => {
    const next = scoreShotDamage(shot).severity;
    if (!next) return highest;
    if (!highest || severityRank[next] > severityRank[highest]) return next;
    return highest;
  }, null);
}

export function calculateShotDamage(shot: Shot): number {
  return scoreShotDamage(shot).damage;
}

function describeTrend(recent: number | null, baseline: number | null, values: number[]): AnalysisTrend {
  if (recent === null || baseline === null || values.length < 8) return 'insufficient';
  const spread = Math.max(...values) - Math.min(...values);
  if (spread >= 45 && Math.abs(recent - baseline) < 5) return 'volatile';
  if (recent - baseline >= 4) return 'improving';
  if (recent - baseline <= -4) return 'declining';
  return 'stable';
}

function commonValue(values: string[]): string {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'No clear pattern';
}

function detectTags(shots: Shot[]): string[] {
  const text = shots.map((shot) => `${shot.notes} ${shot.strikeQuality}`).join(' ').toLowerCase();
  return TAGS.filter((tag) => new RegExp(`\\b${tag}\\b`).test(text)).slice(0, 3);
}

function clubRecommendation(clubName: string, direction: string, distance: string, tags: string[], damage: number): string {
  const isDriver = clubName.toLowerCase().includes('driver');
  if (direction === 'Right') return isDriver ? 'Prioritise playable tee shots and right-miss control.' : 'Work on start-line control and a predictable shape.';
  if (distance === 'Short' || tags.some((tag) => ['fat', 'top', 'topped'].includes(tag))) return 'Add clean-contact and low-point work.';
  if (damage >= 2) return 'Reduce costly misses before chasing extra distance.';
  return 'Maintain this club and monitor the next sample.';
}

function buildClubInsights(shots: Shot[], clubs: ClubConfig[]): ClubInsight[] {
  const grouped = new Map<string, Shot[]>();
  shots.forEach((shot) => {
    const clubId = clubIdForShot(shot, clubs);
    grouped.set(clubId, [...(grouped.get(clubId) || []), shot]);
  });

  return [...grouped.entries()].map(([clubId, clubShots]) => {
    const club = clubs.find((item) => item.id === clubId);
    const sorted = [...clubShots].sort((a, b) => b.date.getTime() - a.date.getTime());
    const scores = sorted.map((shot) => shotQualityScore(shot.shotQuality)).filter((score): score is number => score !== null);
    const recentScores = scores.slice(0, 20);
    const baselineSqi = average(scores);
    const recentSqi = average(recentScores);
    const config = club || { acceptableSideBand: 8, acceptableDistanceBand: 10 };
    const left = clubShots.filter((shot) => shot.side < -config.acceptableSideBand).length;
    const right = clubShots.filter((shot) => shot.side > config.acceptableSideBand).length;
    const centre = clubShots.length - left - right;
    const distanceShots = clubShots.filter((shot) => shot.target > 0);
    const short = distanceShots.filter((shot) => shot.total < shot.target - config.acceptableDistanceBand).length;
    const long = distanceShots.filter((shot) => shot.total > shot.target + config.acceptableDistanceBand).length;
    const good = distanceShots.length - short - long;
    const direction = right > left && right > centre ? 'Right' : left > right && left > centre ? 'Left' : 'Mixed / centred';
    const distance = short > long && short > good ? 'Short' : long > short && long > good ? 'Long' : distanceShots.length ? 'Mostly playable' : 'Not enough target data';
    const damage = clubShots.reduce((sum, shot) => sum + calculateShotDamage(shot), 0);
    const badMisses = clubShots.filter((shot) => calculateShotDamage(shot) >= 1).length;
    const tags = detectTags(clubShots);
    const confidence = shotConfidence(clubShots.length);
    const name = club?.clubName || clubShots[0]?.club || clubId;
    const evidenceParts = [`${clubShots.length} shots`, `${pct(badMisses / clubShots.length)}% costly miss`];
    if (direction !== 'Mixed / centred') evidenceParts.push(`${normalise(direction)}-biased`);

    return {
      clubId,
      clubName: name,
      shots: clubShots.length,
      sqi: recentSqi === null ? null : round(recentSqi),
      recentSqi: recentSqi === null ? null : round(recentSqi),
      baselineSqi: baselineSqi === null ? null : round(baselineSqi),
      change: recentSqi === null || baselineSqi === null ? null : round(recentSqi - baselineSqi),
      trend: describeTrend(recentSqi, baselineSqi, scores),
      badMissPct: pct(badMisses / clubShots.length),
      damage,
      damagePerShot: Math.round((damage / clubShots.length) * 100) / 100,
      severity: highestSeverity(clubShots),
      direction,
      distance,
      tags,
      commonEndLie: commonValue(clubShots.map((shot) => shot.endLie)),
      confidence,
      evidence: evidenceParts.join(', '),
      recommendation: clubRecommendation(name, direction, distance, tags, damage),
    };
  }).sort((a, b) => b.shots - a.shots);
}

function extractReflectionThemes(
  reflections: RoundReflection[],
  practiceSessions: PracticeSession[],
  puttingSessions: AnalysisPuttingSession[],
): ReflectionTheme[] {
  const documents = [
    ...reflections.flatMap((reflection) => [
      reflection.drivingNotes,
      reflection.ironsNotes,
      reflection.shortNotes,
      reflection.puttingNotes,
      reflection.mentalNotes,
      reflection.courseManagementNotes,
    ]),
    ...practiceSessions.map((session) => session.notes),
    ...puttingSessions.flatMap((session) => [session.notes, session.mainMiss]),
  ].map(normalise).filter(Boolean);

  return REFLECTION_THEMES.map((theme) => {
    const count = documents.filter((document) => theme.patterns.some((pattern) => document.includes(pattern))).length;
    return { id: theme.id, label: theme.label, count, confidence: reflectionConfidence(count), linkedData: theme.linkedData, meaning: theme.meaning };
  }).filter((theme) => theme.count > 0).sort((a, b) => b.count - a.count);
}

function clubFromPracticeSession(session: PracticeSession): string {
  return parsePracticeConfigKey(session.clubId).club || session.clubId;
}

function buildTransferInsights(practiceSessions: PracticeSession[], clubs: ClubInsight[], puttingSessions: AnalysisPuttingSession[]): TransferInsight[] {
  const groups = new Map<string, PracticeSession[]>();
  practiceSessions.forEach((session) => {
    const club = clubFromPracticeSession(session);
    groups.set(club, [...(groups.get(club) || []), session]);
  });

  const clubRows = [...groups.entries()].map(([clubId, sessions]): TransferInsight => {
    const sorted = [...sessions].sort((a, b) => b.date.getTime() - a.date.getTime());
    const practiceScores = sorted.map((session) => session.consistency?.overallScore).filter((score): score is number => typeof score === 'number');
    const recentPractice = average(practiceScores.slice(0, 3));
    const baselinePractice = average(practiceScores);
    const course = clubs.find((club) => club.clubId === clubId);
    const name = course?.clubName || clubId.toUpperCase();
    if (practiceScores.length < 2 || !course || course.shots < 8 || course.sqi === null) {
      return { clubName: name, status: 'insufficient', evidence: `${practiceScores.length} practice sessions, ${course?.shots || 0} course shots`, action: 'Capture more matching practice and course shots.', confidence: 'none' };
    }
    const practiceChange = (recentPractice || 0) - (baselinePractice || 0);
    const courseChange = course.change || 0;
    if (practiceChange >= 4 && courseChange >= 3) {
      return { clubName: name, status: 'transferring', evidence: `Practice +${round(practiceChange)}, course SQI +${round(courseChange)}`, action: 'Keep the current practice block.', confidence: course.confidence };
    }
    if (practiceChange >= 4 && courseChange < 3) {
      return { clubName: name, status: 'not-yet-transferring', evidence: `Practice +${round(practiceChange)}, course SQI ${courseChange >= 0 ? '+' : ''}${round(courseChange)}`, action: 'Add pressure reps and a clear on-course intention.', confidence: course.confidence };
    }
    if (courseChange >= 3 && practiceChange <= 0) {
      return { clubName: name, status: 'course-better', evidence: `Course SQI +${round(courseChange)}, practice ${round(practiceChange)}`, action: 'Review what is working on course and reproduce it in practice.', confidence: course.confidence };
    }
    return { clubName: name, status: 'insufficient', evidence: 'No clear transfer movement yet', action: 'Keep capturing matching samples.', confidence: 'low' };
  });

  clubRows.push({
    clubName: 'Putting',
    status: 'insufficient',
    evidence: `${puttingSessions.length} structured putting sessions; no matched round putting outcomes`,
    action: 'Improve round putting capture before drawing a transfer conclusion.',
    confidence: 'none',
  });
  return clubRows.slice(0, 8);
}

function sqiBand(score: number | null): string {
  if (score === null) return 'Not enough data';
  if (score >= 75) return 'Strong';
  if (score >= 60) return 'Improving / playable';
  if (score >= 45) return 'Mixed / needs work';
  return 'Priority problem area';
}

interface RatedRound {
  date: string;
  sqi: number;
  damage: number;
}

function buildRatedRounds(shots: Shot[]): RatedRound[] {
  const grouped = new Map<string, Shot[]>();
  shots.forEach((shot) => {
    const date = roundDateKey(shot);
    grouped.set(date, [...(grouped.get(date) || []), shot]);
  });

  return [...grouped.entries()].map(([date, roundShots]) => {
    const scores = roundShots
      .map((shot) => shotQualityScore(shot.shotQuality))
      .filter((score): score is number => score !== null);
    const sqi = average(scores);
    if (sqi === null) return null;
    return {
      date,
      sqi,
      damage: roundShots.reduce((sum, shot) => sum + calculateShotDamage(shot), 0),
    };
  }).filter((item): item is RatedRound => item !== null);
}

function splitIntoQuartiles<T>(items: T[]): [T[], T[], T[]] {
  if (items.length < 4) return [[], [], items];
  const quarterSize = Math.max(1, Math.floor(items.length / 4));
  return [
    items.slice(0, quarterSize),
    items.slice(quarterSize, items.length - quarterSize),
    items.slice(items.length - quarterSize),
  ];
}

function summariseRounds(id: string, label: string, rounds: RatedRound[]): SqiSegment {
  const sqi = average(rounds.map((item) => item.sqi));
  const damage = rounds.reduce((sum, item) => sum + item.damage, 0);
  return {
    id,
    label,
    rounds: rounds.length,
    sqi: sqi === null ? null : round(sqi),
    handicapEquivalent: describeHandicapEquivalent(sqi),
    damagePerRound: rounds.length ? Math.round((damage / rounds.length) * 10) / 10 : 0,
  };
}

function buildSqiPerspectives(shots: Shot[]) {
  const ratedRounds = buildRatedRounds(shots);
  const chronological = [...ratedRounds].sort((a, b) => a.date.localeCompare(b.date));
  const [early, middleTime, recent] = splitIntoQuartiles(chronological);
  const ranked = [...ratedRounds].sort((a, b) => a.sqi - b.sqi);
  const [lower, middleQuality, top] = splitIntoQuartiles(ranked);

  return {
    chronologicalSqi: [
      summariseRounds('early', 'Early 25%', early),
      summariseRounds('middle-time', 'Middle 50%', middleTime),
      summariseRounds('recent', 'Recent 25%', recent),
    ],
    qualitySqi: [
      summariseRounds('lower', 'Lower 25%', lower),
      summariseRounds('middle-quality', 'Middle 50%', middleQuality),
      summariseRounds('top', 'Top 25%', top),
    ],
    roundScores: chronological.map((item) => item.sqi),
  };
}

function trendText(trend: AnalysisTrend): string {
  if (trend === 'improving') return 'improving';
  if (trend === 'declining') return 'slipping';
  if (trend === 'volatile') return 'volatile';
  if (trend === 'stable') return 'stable';
  return 'still forming';
}

export function buildAnalysisModel({
  shots,
  clubs,
  roundReflections,
  practiceSessions,
  puttingSessions = [],
}: AnalysisInput): AnalysisModel {
  const sorted = [...shots].sort((a, b) => b.date.getTime() - a.date.getTime());
  const scores = sorted.map((shot) => shotQualityScore(shot.shotQuality)).filter((score): score is number => score !== null);
  const currentScores = scores.slice(0, 50);
  const sqi = average(currentScores);
  const baselineSqi = average(scores);
  const change = sqi === null || baselineSqi === null ? null : round(sqi - baselineSqi);
  const { chronologicalSqi, qualitySqi, roundScores } = buildSqiPerspectives(shots);
  const rounds = new Set(shots.map(roundDateKey)).size;
  const confidence = roundConfidence(rounds);
  const damage = shots.reduce((sum, shot) => sum + calculateShotDamage(shot), 0);
  const badMisses = shots.filter((shot) => calculateShotDamage(shot) >= 1).length;
  const clubInsights = buildClubInsights(shots, clubs);
  const priorities = [...clubInsights]
    .filter((club) => club.shots >= 8)
    .sort((a, b) => (b.damagePerShot * 2 + b.badMissPct / 100 + (100 - (b.sqi || 0)) / 100) - (a.damagePerShot * 2 + a.badMissPct / 100 + (100 - (a.sqi || 0)) / 100))
    .slice(0, 3)
    .map((club, index) => ({ ...club, rank: index + 1 }));
  const reliableClubs = [...clubInsights]
    .filter((club) => club.shots >= 8 && club.sqi !== null)
    .sort((a, b) => ((b.sqi || 0) - b.badMissPct - b.damagePerShot * 10) - ((a.sqi || 0) - a.badMissPct - a.damagePerShot * 10))
    .slice(0, 3);
  const trend = describeTrend(chronologicalSqi[2].sqi, chronologicalSqi[0].sqi, roundScores);
  const top = priorities[0];
  const strength = reliableClubs[0];
  const diagnosis = shots.length < 8
    ? 'There is not enough course data yet for a reliable whole-game diagnosis. Keep capturing shots and the coaching view will sharpen.'
    : `Your current game is ${trendText(trend)} at ${sqiBand(sqi)} quality. ${top ? `${top.clubName} is the clearest score-risk area: ${top.evidence}.` : ''} ${strength && strength.clubId !== top?.clubId ? `${strength.clubName} is currently one of the more reliable clubs in the bag.` : ''}`.trim();
  const reflectionThemes = extractReflectionThemes(roundReflections, practiceSessions, puttingSessions);
  const transferInsights = buildTransferInsights(practiceSessions, clubInsights, puttingSessions);
  const formInsights: FormInsight[] = [
    {
      area: 'Overall game',
      trend,
      evidence: sqi === null ? 'Not enough rated shots' : `SQI ${round(sqi)}${change === null ? '' : ` (${change >= 0 ? '+' : ''}${change} vs baseline)`}`,
      meaning: trend === 'improving' ? 'Recent shot quality is moving in the right direction.' : trend === 'declining' ? 'Recent quality needs a reset block.' : 'Keep building the sample and watch for a clearer movement.',
      confidence,
    },
    ...clubInsights.filter((club) => club.shots >= 8).slice(0, 5).map((club) => ({
      area: club.clubName,
      trend: club.trend,
      evidence: `SQI ${club.sqi ?? '-'}, costly miss ${club.badMissPct}%`,
      meaning: club.recommendation,
      confidence: club.confidence,
    })),
  ];

  return {
    sqi: sqi === null ? null : round(sqi),
    baselineSqi: baselineSqi === null ? null : round(baselineSqi),
    change,
    currentLevel: sqiBand(sqi),
    handicapEquivalent: describeHandicapEquivalent(sqi),
    trend,
    shots: shots.length,
    rounds,
    confidence,
    badMissPct: shots.length ? pct(badMisses / shots.length) : 0,
    scoringDamage: Math.round(damage * 10) / 10,
    damagePerRound: rounds ? Math.round((damage / rounds) * 10) / 10 : 0,
    diagnosis,
    topLeak: top ? `${top.clubName}: ${top.direction.toLowerCase()} / ${top.distance.toLowerCase()}` : 'More data needed',
    priorities,
    reliableClubs,
    clubInsights,
    formInsights,
    transferInsights,
    reflectionThemes,
    reflectionSummary: reflectionThemes[0] ? `${reflectionThemes[0].label} is the most common reflection theme (${reflectionThemes[0].count} mentions).` : 'No recurring reflection theme yet. Add short notes after rounds and practice sessions.',
    chronologicalSqi,
    qualitySqi,
  };
}
