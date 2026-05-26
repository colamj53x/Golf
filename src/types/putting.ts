export interface ScoringInput {
  id: string;
  label: string;
  points: number;
}

export type PuttingMetric = 'startLineStrike' | 'paceTouch' | 'conversionPressure';

export interface PuttingMetricScore {
  metric: PuttingMetric;
  label: string;
  percent: number;
}

export interface LevelBand {
  min: number;
  max: number;
  label: string;
}

export interface PuttingDrill {
  id: string;
  user_id: string | null;
  category: 'indoor' | 'outdoor';
  name: string;
  purpose: string | null;
  setup: string | null;
  reps: number;
  scoring_inputs: ScoringInput[];
  max_score: number;
  scaled: boolean;
  scaled_max: number | null;
  level_bands: LevelBand[];
  recommendation: string | null;
  is_builtin: boolean;
  sort_order: number;
  scoring_mode?: 'standard' | 'pressure_ladder';
}

export interface DrillResult {
  drill_id: string;
  drill_name: string;
  counts: Record<string, number>;
  raw_score: number;
  final_score: number; // scaled if applicable
  max_score: number; // scaled_max if scaled, else max_score
  level: string;
  percent: number;
  metric_scores?: PuttingMetricScore[];
  putts_used?: number;
}

export interface PuttingSessionRecord {
  id: string;
  user_id: string;
  category: 'indoor' | 'outdoor';
  session_date: string;
  location: string | null;
  carpet_speed: string | null;
  target_type: string | null;
  session_length: string | null;
  notes_before: string | null;
  total_score: number;
  max_total: number;
  level: string | null;
  best_drill: string | null;
  weakest_drill: string | null;
  main_miss: string | null;
  recommendation: string | null;
  drill_results: DrillResult[];
  created_at: string;
}

export const SESSION_LEVELS: LevelBand[] = [
  { min: 0, max: 49, label: 'Level 1: Needs Tidying' },
  { min: 50, max: 69, label: 'Level 2: Functional' },
  { min: 70, max: 84, label: 'Level 3: Useful Home Practice' },
  { min: 85, max: 94, label: 'Level 4: Strong' },
  { min: 95, max: 100, label: 'Level 5: Carpet Champion' },
];

export function getLevelLabel(score: number, bands: LevelBand[]): string {
  const band = bands.find(b => score >= b.min && score <= b.max);
  return band?.label ?? '—';
}
