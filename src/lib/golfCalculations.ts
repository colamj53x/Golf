// Golf calculation utilities
import { Shot, ProcessedShot, ClubConfig, CLUB_CODE_MAP } from '@/types/golf';

export function getClubConfigId(clubCode: string): string {
  const normalized = clubCode.trim();
  return CLUB_CODE_MAP[normalized] || normalized.toLowerCase();
}

// Bad miss End Lie values - penalty situations or recovery required
const BAD_MISS_END_LIES = [
  'recovery',
  'penalty',
  'water',
  'ob',
  'out of bounds',
  'hazard',
  'trees',
  'unplayable',
];

// End Lies that indicate the shot was targeting the green
const GREEN_TARGET_END_LIES = [
  'green',
  'fringe',
  'greenside',
  'hole',
];

// End Lies that count as successfully hitting the green
const GREEN_HIT_END_LIES = [
  'green',
  'fringe',
  'hole',
];

export function processShot(shot: Shot, config: ClubConfig | undefined, distanceToTargetTolerance: number = 10): ProcessedShot {
  const notesLower = shot.notes?.toLowerCase() || '';
  
  // No longer excluding any shots - all shots count in all calculations
  const isLowIntentionalShot = false;

  if (!config) {
    return {
      ...shot,
      isOnTarget: false,
      isRight: false,
      isLeft: false,
      isShort: false,
      isBadMiss: false,
      isTargetingGreen: false,
      isLowIntentionalShot,
      qualityScore: 0,
      distanceToTarget: null,
    };
  }

  const sideAbs = Math.abs(shot.side);
  const isOnTarget = sideAbs <= config.acceptableSideBand;
  const isRight = shot.side > config.acceptableSideBand;
  const isLeft = shot.side < -config.acceptableSideBand;
  
  const isAsIntended = notesLower.includes('intended');
  const isShort = !isAsIntended && shot.total < (config.stockDistance - config.acceptableDistanceBand);
  
  // Check End Lie for bad miss situations
  const endLieLower = shot.endLie?.toLowerCase().trim() || '';
  const isPenaltyLie = BAD_MISS_END_LIES.some(badLie => endLieLower.includes(badLie));
  
  // Also check notes for recovery/punch indicators
  const isRecoveryFromNotes = notesLower.includes('recovery') || notesLower.includes('punch');
  
  const isBadMiss = isPenaltyLie || isRecoveryFromNotes;

  // Calculate quality score
  let qualityScore = 100;
  if (isPenaltyLie) qualityScore -= 30;
  if (isRecoveryFromNotes) qualityScore -= 20;
  const offlinePenalty = Math.min(sideAbs - config.acceptableSideBand, 25);
  if (offlinePenalty > 0) qualityScore -= offlinePenalty;
  if (isShort) qualityScore -= 10;

  // Distance to target calculation - only for shots "targeting the green"
  // A shot is targeting the green if EITHER:
  // 1. Target distance is within tolerance of the club's stock distance, OR
  // 2. End lie indicates green/fringe (they were going for the green)
  const isWithinStockTolerance = shot.target > 0 && 
    Math.abs(shot.target - config.stockDistance) <= distanceToTargetTolerance;
  const isEndLieGreen = GREEN_TARGET_END_LIES.some(lie => endLieLower.includes(lie));
  const isTargetingGreen = isWithinStockTolerance || isEndLieGreen;
  
  // Use endDistanceFromTarget (proximity to hole after the shot)
  let distanceToTarget: number | null = null;
  if (config.distanceToTargetEnabled && isTargetingGreen && !isBadMiss) {
    distanceToTarget = shot.endDistanceFromTarget;
  }

  return {
    ...shot,
    isOnTarget,
    isRight,
    isLeft,
    isShort,
    isBadMiss,
    isTargetingGreen,
    isLowIntentionalShot,
    qualityScore,
    distanceToTarget,
  };
}

export function calculateIQR(values: number[]): number {
  if (values.length < 4) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  
  return sorted[q3Index] - sorted[q1Index];
}

// Shot quality levels in order from best to worst
const SHOT_QUALITY_LEVELS = ['Pro', 'Elite Am', '0 Handicap', '5 Handicap', '10 Handicap', '15 Handicap', '20 Handicap', '25 Handicap'];

export interface ShotQualityBreakdown {
  [key: string]: number;
}

// Exported interface for calculateMetrics return type
export interface MetricsResult {
  onTargetPct: number;
  rightPct: number;
  leftPct: number;
  shortPct: number;
  badMissPct: number;
  avgDistanceHit: number;
  longestHit: number;
  distanceVariation: number;
  sideVariation: number;
  greensTargetedPct: number;
  greensHitPct: number;
  greensHitRawPct: number; // Simple: % of ALL shots finishing on green/fringe/hole
  avgDistanceToTarget: number | null;
  distanceToTargetVariation: number | null;
  proximityWithin1mPct: number;
  proximityWithin3mPct: number;
  proximityWithin5mPct: number;
  proximityWithin10mPct: number;
  strikeCentrePct: number;
  shotQualityPcts: ShotQualityBreakdown;
  shotCount: number;
}

export function calculateMetrics(shots: ProcessedShot[], config: ClubConfig | undefined): MetricsResult {
  const emptyShotQuality: ShotQualityBreakdown = {};
  SHOT_QUALITY_LEVELS.forEach(level => { emptyShotQuality[level] = 0; });

  if (shots.length === 0) {
    return {
      onTargetPct: 0,
      rightPct: 0,
      leftPct: 0,
      shortPct: 0,
      badMissPct: 0,
      avgDistanceHit: 0,
      longestHit: 0,
      distanceVariation: 0,
      sideVariation: 0,
      greensTargetedPct: 0,
      greensHitPct: 0,
      greensHitRawPct: 0,
      avgDistanceToTarget: null as number | null,
      distanceToTargetVariation: null as number | null,
      proximityWithin1mPct: 0,
      proximityWithin3mPct: 0,
      proximityWithin5mPct: 0,
      proximityWithin10mPct: 0,
      strikeCentrePct: 0,
      shotQualityPcts: emptyShotQuality,
      shotCount: 0,
    };
  }

  const total = shots.length;
  const onTarget = shots.filter(s => s.isOnTarget).length;
  const right = shots.filter(s => s.isRight).length;
  const left = shots.filter(s => s.isLeft).length;
  const short = shots.filter(s => s.isShort).length;
  const badMiss = shots.filter(s => s.isBadMiss).length;

  // All shots included in distance calculations (no exclusions)
  const distances = shots.map(s => s.total);
  const sides = shots.map(s => Math.abs(s.side));
  
  // Greens targeted: shots that were targeting the green (not bad misses)
  const greensTargetedShots = shots.filter(s => s.isTargetingGreen && !s.isBadMiss);
  const greensTargetedCount = greensTargetedShots.length;
  
  // Greens hit: of the shots targeting the green, how many landed on green/fringe/hole
  const greensHitCount = greensTargetedShots.filter(s => {
    const endLieLower = s.endLie?.toLowerCase().trim() || '';
    return GREEN_HIT_END_LIES.some(lie => endLieLower.includes(lie));
  }).length;
  
  // Raw greens hit: % of ALL shots that finished on green/fringe/hole (regardless of targeting)
  const allGreensHitCount = shots.filter(s => {
    const endLieLower = s.endLie?.toLowerCase().trim() || '';
    return GREEN_HIT_END_LIES.some(lie => endLieLower.includes(lie));
  }).length;
  
  const distancesToTarget = greensTargetedShots
    .filter(s => s.distanceToTarget !== null)
    .map(s => s.distanceToTarget as number);

  // Proximity breakdown percentages (of green-targeted shots with valid distance)
  const proxTotal = distancesToTarget.length;
  const proximityWithin1mPct = proxTotal > 0 ? (distancesToTarget.filter(d => Math.abs(d) <= 1).length / proxTotal) * 100 : 0;
  const proximityWithin3mPct = proxTotal > 0 ? (distancesToTarget.filter(d => Math.abs(d) <= 3).length / proxTotal) * 100 : 0;
  const proximityWithin5mPct = proxTotal > 0 ? (distancesToTarget.filter(d => Math.abs(d) <= 5).length / proxTotal) * 100 : 0;
  const proximityWithin10mPct = proxTotal > 0 ? (distancesToTarget.filter(d => Math.abs(d) <= 10).length / proxTotal) * 100 : 0;

  // Strike quality - centre percentage
  const centreStrikes = shots.filter(s => {
    const strikeQualityLower = s.strikeQuality?.toLowerCase().trim() || '';
    return strikeQualityLower === 'centre' || strikeQualityLower === 'center';
  }).length;
  const strikeCentrePct = (centreStrikes / total) * 100;

  // Shot quality breakdown - cumulative (at this level or better)
  const shotQualityPcts: ShotQualityBreakdown = {};
  let cumulativeCount = 0;
  SHOT_QUALITY_LEVELS.forEach(level => {
    const count = shots.filter(s => s.shotQuality === level).length;
    cumulativeCount += count;
    shotQualityPcts[level] = (cumulativeCount / total) * 100;
  });

  return {
    onTargetPct: (onTarget / total) * 100,
    rightPct: (right / total) * 100,
    leftPct: (left / total) * 100,
    shortPct: (short / total) * 100,
    badMissPct: (badMiss / total) * 100,
    avgDistanceHit: distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : 0,
    longestHit: distances.length > 0 ? Math.max(...distances) : 0,
    distanceVariation: calculateIQR(distances),
    sideVariation: calculateIQR(sides),
    greensTargetedPct: (greensTargetedCount / total) * 100,
    greensHitPct: greensTargetedCount > 0 ? (greensHitCount / greensTargetedCount) * 100 : 0,
    greensHitRawPct: (allGreensHitCount / total) * 100,
    avgDistanceToTarget: distancesToTarget.length > 0 
      ? distancesToTarget.reduce((a, b) => a + b, 0) / distancesToTarget.length 
      : null,
    distanceToTargetVariation: distancesToTarget.length >= 4 
      ? calculateIQR(distancesToTarget.map(Math.abs)) 
      : null,
    proximityWithin1mPct,
    proximityWithin3mPct,
    proximityWithin5mPct,
    proximityWithin10mPct,
    strikeCentrePct,
    shotQualityPcts,
    shotCount: total,
  };
}

export function splitIntoThirds<T>(items: T[]): [T[], T[], T[]] {
  const third = Math.ceil(items.length / 3);
  const oldest = items.slice(0, third);
  const middle = items.slice(third, third * 2);
  const mostRecent = items.slice(third * 2);
  return [mostRecent, middle, oldest];
}

export function splitByQualityCumulative(shots: ProcessedShot[]): [ProcessedShot[], ProcessedShot[], ProcessedShot[], ProcessedShot[]] {
  const sorted = [...shots].sort((a, b) => b.qualityScore - a.qualityScore);
  const quarter = Math.ceil(sorted.length / 4);
  const half = Math.ceil(sorted.length / 2);
  const threeQuarter = Math.ceil(sorted.length * 0.75);
  
  // Cumulative: Top 25% includes best quarter, Top 50% includes best half, etc.
  const top25 = sorted.slice(0, quarter);
  const top50 = sorted.slice(0, half);
  const top75 = sorted.slice(0, threeQuarter);
  const top100 = sorted; // All shots
  
  return [top25, top50, top75, top100];
}

export function getLastNRounds(shots: ProcessedShot[], n: number): ProcessedShot[] {
  // Get unique dates, sorted descending (most recent first)
  const uniqueDates = [...new Set(shots.map(s => getShotDateKey(s.date)))]
    .map(dateStr => parseDate(dateStr).date)
    .sort((a, b) => b.getTime() - a.getTime());
  
  // Take the last n dates
  const lastNDates = uniqueDates.slice(0, n);
  const lastNDateStrings = new Set(lastNDates.map(d => getShotDateKey(d)));
  
  // Filter shots to only those in the last n rounds
  return shots.filter(s => lastNDateStrings.has(getShotDateKey(s.date)));
}

export interface DateParseResult {
  date: Date;
  hadIssue: boolean;
  originalValue: string;
}

export function parseDate(dateStr: string): DateParseResult {
  const trimmed = dateStr.trim();

  const fromParts = (year: number, month: number, day: number): DateParseResult => {
    const date = new Date(Date.UTC(year, month - 1, day));
    const isValid = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    return { date: isValid ? date : new Date(NaN), hadIssue: !isValid, originalValue: trimmed };
  };

  const fromLocalCalendarDate = (value: Date): DateParseResult => {
    if (Number.isNaN(value.getTime())) {
      return { date: new Date(NaN), hadIssue: true, originalValue: trimmed };
    }

    return fromParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  };
  
  // Try YYYY-MM-DD format first
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    return fromParts(year, month, day);
  }

  // Parse full timestamps with timezone information and normalize them to the
  // user's local calendar day so an early-morning local round does not end up
  // grouped under the previous UTC date.
  const timestampWithZone = trimmed.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{2}):?(\d{2})$/
  );
  if (timestampWithZone) {
    const [, year, month, day, hour, minute, second = '00', zoneHour, zoneMinute] = timestampWithZone;
    const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}${zoneHour}:${zoneMinute}`;
    return fromLocalCalendarDate(new Date(isoString));
  }

  const isoTimestamp = new Date(trimmed);
  if (!Number.isNaN(isoTimestamp.getTime()) && /[tT ]\d{1,2}:\d{2}/.test(trimmed)) {
    return fromLocalCalendarDate(isoTimestamp);
  }
  
  // Try DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY, or D-M-YYYY format
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    return fromParts(year, Number(dmy[2]), Number(dmy[1]));
  }

  return { date: new Date(NaN), hadIssue: true, originalValue: trimmed };
}

export function getShotDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export interface CSVParseResult {
  shots: Shot[];
  warnings: { row: number; issue: string }[];
}

function parseCSVRow(row: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    const nextChar = row[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseNumeric(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function estimateDispersion(dispersion: string, shotNotes: string, shape: string): number {
  const parsed = Number.parseFloat(dispersion);
  if (Number.isFinite(parsed)) return parsed;

  const text = `${shotNotes} ${shape}`.toLowerCase();
  const rightMisses = [
    { term: 'slice', amount: 30 },
    { term: 'push', amount: 18 },
    { term: 'fade', amount: 12 },
  ];
  const leftMisses = [
    { term: 'hook', amount: 30 },
    { term: 'pull', amount: 18 },
    { term: 'draw', amount: 12 },
  ];

  const rightAmount = rightMisses.reduce((amount, miss) => text.includes(miss.term) ? Math.max(amount, miss.amount) : amount, 0);
  const leftAmount = leftMisses.reduce((amount, miss) => text.includes(miss.term) ? Math.max(amount, miss.amount) : amount, 0);

  if (rightAmount > leftAmount) return rightAmount;
  if (leftAmount > rightAmount) return -leftAmount;
  return 0;
}

export function parseCSV(csvContent: string): CSVParseResult {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return { shots: [], warnings: [] };

  const headerValues = parseCSVRow(lines[0]).map(header => header.trim().toLowerCase());

  const normalizedHeader = headerValues.map(h => h.replace(/[^a-z0-9]/g, ''));
  const legacyHeader = ['date', 'club', 'type', 'startlie', 'endlie', 'strikequality', 'shotquality', 'target', 'enddistancefromtarget', 'distancehit', 'dispersion'];
  const isLegacyFormat = legacyHeader.every((name, index) => normalizedHeader[index] === name);
  const column = (aliases: string[]) => {
    for (const alias of aliases) {
      const index = normalizedHeader.findIndex(header => header === alias);
      if (index !== -1) return index;
    }
    return -1;
  };
  const indexes = {
    date: isLegacyFormat ? 0 : column(['date', 'shotdate']),
    club: isLegacyFormat ? 1 : column(['club', 'clubcode']),
    type: isLegacyFormat ? 2 : column(['category', 'shottype', 'type']),
    startLie: isLegacyFormat ? 3 : column(['startlie', 'lie']),
    endLie: isLegacyFormat ? 4 : column(['endlie', 'resultlie', 'finishlie']),
    strikeQuality: isLegacyFormat ? 5 : column(['strikequality', 'strike', 'quality']),
    shotQuality: isLegacyFormat ? 6 : column(['shotquality']),
    target: isLegacyFormat ? 7 : column(['target', 'targetdistance', 'distancetohole', 'distancetotargetm']),
    endDistFromTarget: isLegacyFormat ? 8 : column(['enddistancefromtarget', 'enddistance', 'proximity', 'proximitytohole', 'proximitym']),
    distanceHit: isLegacyFormat ? 9 : column(['distancehit', 'total', 'totaldistance', 'distancetraveledm']),
    dispersion: isLegacyFormat ? 10 : column(['dispersion', 'offline', 'side', 'lateral', 'degreesoffline']),
    shotNotes: isLegacyFormat ? 11 : column(['shotnotes', 'notes', 'note']),
    trajectory: column(['trajectory']),
    shape: column(['shape']),
    clubType: column(['clubtype']),
  };

  const shots: Shot[] = [];
  const warnings: { row: number; issue: string }[] = [];

  const optionalIndexes = ['shotNotes', 'trajectory', 'shape', 'clubType'];
  if (Object.entries(indexes).some(([key, index]) => !optionalIndexes.includes(key) && index === -1)) {
    return {
      shots: [],
      warnings: [{ row: 1, issue: 'CSV header does not match the required shot data columns.' }],
    };
  }
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = parseCSVRow(line);

    if (values.length >= 11) {
      const read = (index: number) => index >= 0 ? values[index] || '' : '';
      const date = read(indexes.date);
      const club = read(indexes.club);
      const type = read(indexes.type);
      const startLie = read(indexes.startLie);
      const endLie = read(indexes.endLie);
      const strikeQuality = read(indexes.strikeQuality);
      const shotQuality = read(indexes.shotQuality);
      const target = read(indexes.target);
      const endDistFromTarget = read(indexes.endDistFromTarget);
      const distanceHit = read(indexes.distanceHit);
      const dispersion = read(indexes.dispersion);
      const trajectory = read(indexes.trajectory);
      const shape = read(indexes.shape);
      const clubType = read(indexes.clubType);
      const shotNotes = read(indexes.shotNotes) || trajectory || shape;
      
      const normalizedClub = club.trim().toLowerCase();
      const normalizedType = type.trim().toLowerCase();
      const normalizedClubType = clubType.trim().toLowerCase();
      if (normalizedClub === 'pu' || normalizedType === 'putting' || normalizedClubType === 'putter') continue;
      
      const dateResult = parseDate(date);
      if (dateResult.hadIssue) {
        warnings.push({ 
          row: i + 1, 
          issue: `Invalid date "${dateResult.originalValue}" - row skipped` 
        });
        continue;
      }
      
      shots.push({
        id: `shot-${i}`,
        club: club.trim(),
        type: type.trim(),
        shotFamily: '',
        swingEffort: '',
        targetIntent: '',
        target: parseNumeric(target),
        total: parseNumeric(distanceHit),
        side: estimateDispersion(dispersion, shotNotes, shape),
        shotQuality: shotQuality.trim(),
        date: dateResult.date,
        startLie: startLie.trim(),
        endLie: endLie.trim(),
        strikeQuality: strikeQuality.trim(),
        endDistanceFromTarget: parseNumeric(endDistFromTarget),
        notes: shotNotes?.trim() || '',
      });
    } else if (values.length > 0 && values.some(v => v.trim())) {
      warnings.push({ 
        row: i + 1, 
        issue: `Incomplete row - expected 11 columns, got ${values.length}` 
      });
    }
  }

  return { shots, warnings };
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDistance(value: number | null): string {
  if (value === null) return '-';
  return `${value.toFixed(1)}m`;
}
