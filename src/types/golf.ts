export type ClubCategory = 'Tee' | 'Long Approach' | 'Approach' | 'Short / Scoring';

export interface ClubConfig {
  id: string;
  clubName: string;
  clubCategory: ClubCategory;
  stockDistance: number;
  acceptableDistanceBand: number;
  acceptableSideBand: number;
  distanceToTargetEnabled: boolean;
}

export interface Shot {
  id: string;
  club: string;
  type: string;              // Shot type (e.g., practice, round)
  shotFamily: string;        // Intended shot family (full, pitch, chip, etc.)
  swingEffort: string;       // Intended effort (full, half, etc.)
  targetIntent: string;      // Intended destination (fairway or green)
  holeNumber: number | null; // Round hole number when supplied by the source export
  shotNumber: number | null; // Shot sequence within the hole when supplied by the source export
  target: number;            // Distance to hole when taking the shot
  total: number;             // Distance hit (how far the ball traveled)
  side: number;              // Dispersion: positive = right, negative = left
  shotQuality: string;       // Shot quality rating
  date: Date;                // Date the shot was hit
  startLie: string;          // Starting lie (fairway, rough, etc.)
  endLie: string;            // Ending lie (green, rough, penalty, etc.)
  strikeQuality: string;     // Strike quality rating
  endDistanceFromTarget: number; // Distance from hole after shot
  notes: string;
}

export interface RoundReflection {
  id: string;
  roundDate: string;
  generalComments: string;
  drivingNotes: string;
  ironsNotes: string;
  shortNotes: string;
  puttingNotes: string;
  mentalNotes: string;
  courseManagementNotes: string;
  playingPartnerIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayingPartner {
  id: string;
  name: string;
  notes?: string;
  hasMobileNumber?: boolean;
  playedDates?: string[];
}

export interface ProcessedShot extends Shot {
  isOnTarget: boolean;
  isRight: boolean;
  isLeft: boolean;
  isShort: boolean;
  isBadMiss: boolean;
  isTargetingGreen: boolean;
  isLowIntentionalShot: boolean; // Punch/chip shots to exclude from distance calcs
  qualityScore: number;
  distanceToTarget: number | null;
}

export interface MetricRow {
  metric: string;
  period1: string | number;
  period2: string | number;
  period3: string | number;
}

export interface FilterState {
  club: string;
  startLie: string;
  dateRange: { start: Date | null; end: Date | null };
  includeType: 'practice' | 'rounds' | 'both';
}

export const DEFAULT_CLUB_CONFIGS: ClubConfig[] = [
  {
    id: 'dr',
    clubName: 'Driver',
    clubCategory: 'Tee',
    stockDistance: 230,
    acceptableDistanceBand: 20,
    acceptableSideBand: 15,
    distanceToTargetEnabled: false,
  },
  {
    id: '3w',
    clubName: '3 Wood',
    clubCategory: 'Tee',
    stockDistance: 210,
    acceptableDistanceBand: 18,
    acceptableSideBand: 12,
    distanceToTargetEnabled: false,
  },
  {
    id: '5w',
    clubName: '5 Wood',
    clubCategory: 'Long Approach',
    stockDistance: 195,
    acceptableDistanceBand: 15,
    acceptableSideBand: 12,
    distanceToTargetEnabled: true,
  },
  {
    id: '4h',
    clubName: '4 Hybrid',
    clubCategory: 'Long Approach',
    stockDistance: 185,
    acceptableDistanceBand: 12,
    acceptableSideBand: 10,
    distanceToTargetEnabled: true,
  },
  {
    id: '5h',
    clubName: '5 Hybrid',
    clubCategory: 'Long Approach',
    stockDistance: 175,
    acceptableDistanceBand: 12,
    acceptableSideBand: 10,
    distanceToTargetEnabled: true,
  },
  {
    id: '5i',
    clubName: '5 Iron',
    clubCategory: 'Approach',
    stockDistance: 165,
    acceptableDistanceBand: 10,
    acceptableSideBand: 8,
    distanceToTargetEnabled: true,
  },
  {
    id: '6i',
    clubName: '6 Iron',
    clubCategory: 'Approach',
    stockDistance: 155,
    acceptableDistanceBand: 10,
    acceptableSideBand: 8,
    distanceToTargetEnabled: true,
  },
  {
    id: '7i',
    clubName: '7 Iron',
    clubCategory: 'Approach',
    stockDistance: 145,
    acceptableDistanceBand: 8,
    acceptableSideBand: 7,
    distanceToTargetEnabled: true,
  },
  {
    id: '8i',
    clubName: '8 Iron',
    clubCategory: 'Approach',
    stockDistance: 135,
    acceptableDistanceBand: 8,
    acceptableSideBand: 6,
    distanceToTargetEnabled: true,
  },
  {
    id: '9i',
    clubName: '9 Iron',
    clubCategory: 'Approach',
    stockDistance: 125,
    acceptableDistanceBand: 7,
    acceptableSideBand: 6,
    distanceToTargetEnabled: true,
  },
  {
    id: 'pw',
    clubName: 'PW',
    clubCategory: 'Approach',
    stockDistance: 115,
    acceptableDistanceBand: 6,
    acceptableSideBand: 5,
    distanceToTargetEnabled: true,
  },
  {
    id: 'gw',
    clubName: 'GW',
    clubCategory: 'Short / Scoring',
    stockDistance: 100,
    acceptableDistanceBand: 5,
    acceptableSideBand: 5,
    distanceToTargetEnabled: true,
  },
  {
    id: 'sw',
    clubName: 'SW',
    clubCategory: 'Short / Scoring',
    stockDistance: 85,
    acceptableDistanceBand: 5,
    acceptableSideBand: 4,
    distanceToTargetEnabled: true,
  },
  {
    id: 'lw',
    clubName: 'LW',
    clubCategory: 'Short / Scoring',
    stockDistance: 65,
    acceptableDistanceBand: 4,
    acceptableSideBand: 4,
    distanceToTargetEnabled: true,
  },
];

export const CLUB_CODE_MAP: Record<string, string> = {
  'Dr': 'dr',
  'Driver': 'dr',
  '3W': '3w',
  '3 Wood': '3w',
  '5W': '5w',
  '5 Wood': '5w',
  '4H': '4h',
  '4 Hybrid': '4h',
  '5H': '5h',
  '5 Hybrid': '5h',
  '5I': '5i',
  '5 Iron': '5i',
  '6I': '6i',
  '6 Iron': '6i',
  '7I': '7i',
  '7 Iron': '7i',
  '8I': '8i',
  '8 Iron': '8i',
  '9I': '9i',
  '9 Iron': '9i',
  'PW': 'pw',
  'GW': 'gw',
  'SW': 'sw',
  'LW': 'lw',
};

export function normalizeClubCode(club: string): string {
  const trimmed = club.trim();
  const normalized = trimmed.toLowerCase();

  if (normalized === 'dr' || normalized === 'driver') return 'Dr';
  if (/^\d+[a-z]$/.test(normalized)) return normalized.toUpperCase();

  const mapped = Object.entries(CLUB_CODE_MAP)
    .find(([label]) => label.toLowerCase() === normalized)?.[1];

  if (mapped === 'dr') return 'Dr';
  if (mapped) return mapped.toUpperCase();
  return trimmed.substring(0, 10);
}
