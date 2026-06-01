export interface ScoringInput {
  id: string;
  label: string;
  points: number;
}

export type PuttingMetric = 'startLineStrike' | 'paceTouch' | 'conversionPressure';
export type PuttingSessionType = 'indoor' | 'outdoor' | 'technique' | 'warmup' | 'benchmark';
export type PuttingDifficulty = 'beginner' | 'developing' | 'strong' | 'advanced';

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
  location?: 'indoor' | 'outdoor' | 'both';
  skill_tags?: string[];
  difficulty?: PuttingDifficulty;
  time_minutes?: number;
  equipment?: string[];
  best_for?: string[];
  progression?: string | null;
  regression?: string | null;
  blast_compatible?: boolean;
  cue_cards?: string[];
  common_fault?: string | null;
  quick_fix?: string | null;
}

export interface BlastMotionSetData {
  tempo_ratio?: number | null;
  backstroke_time?: number | null;
  forwardstroke_time?: number | null;
  total_stroke_time?: number | null;
  tempo_consistency?: number | null;
  face_rotation?: number | null;
  lie_loft_change?: number | null;
  stroke_length?: number | null;
  notes?: string;
  screenshot_data_url?: string;
  screenshot_name?: string;
  screenshot_data_urls?: string[];
  screenshot_names?: string[];
  extraction_confidence?: 'high' | 'medium' | 'low';
  extraction_notes?: string;
  extracted_at?: string;
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
  blast?: BlastMotionSetData;
  session_meta?: {
    session_type?: PuttingSessionType;
    practice_focus?: string;
    selected_cue?: string;
    reflection_what_worked?: string;
    reflection_what_failed?: string;
    reflection_next_focus?: string;
    confidence_after?: number;
  };
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
  session_type?: PuttingSessionType;
  practice_focus?: string | null;
  selected_cue?: string | null;
  green_speed?: string | null;
  reflection_what_worked?: string | null;
  reflection_what_failed?: string | null;
  reflection_next_focus?: string | null;
  confidence_after?: number | null;
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
