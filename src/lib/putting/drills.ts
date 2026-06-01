import { PuttingDrill, PuttingMetric, PuttingSessionType } from '@/types/putting';

export const PUTTING_METRIC_LABELS: Record<PuttingMetric, string> = {
  startLineStrike: 'Start Line & Strike',
  paceTouch: 'Pace & Touch',
  conversionPressure: 'Conversion & Pressure',
};

const baseDrills: PuttingDrill[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: null,
    category: 'indoor',
    name: 'Start-Line Gate',
    purpose: 'Tests face aim and start direction.',
    setup: 'Set a gate about 30 cm in front of the ball. Putt from 1.5 m.',
    reps: 20,
    scoring_inputs: [
      { id: 'through_gate_holed', label: 'Through gate and holed or hit target', points: 2 },
      { id: 'through_gate_miss', label: 'Through gate but missed target', points: 1 },
      { id: 'missed_gate', label: 'Hit or missed gate', points: 0 },
    ],
    max_score: 40,
    scaled: false,
    scaled_max: null,
    level_bands: [
      { min: 0, max: 20, label: 'Needs work' },
      { min: 21, max: 31, label: 'Decent' },
      { min: 32, max: 35, label: 'Good' },
      { min: 36, max: 40, label: 'Excellent' },
    ],
    recommendation: 'Rebuild the face-first routine and roll through a near start spot.',
    is_builtin: true,
    sort_order: 10,
    scoring_mode: 'standard',
  },
  {
    id: '99999999-9999-4999-8999-999999999999',
    user_id: null,
    category: 'indoor',
    name: 'Spot Roll Drill',
    purpose: 'Tests whether you can start the ball over a chosen spot.',
    setup: 'Place a coin, tape mark, or small flat object 10-30 cm in front of the ball on the intended start line. Putt from 1-2 m.',
    reps: 20,
    scoring_inputs: [
      { id: 'over_spot_holed', label: 'Over spot and holed or hit target', points: 2 },
      { id: 'over_spot_miss', label: 'Over spot but missed target', points: 1 },
      { id: 'missed_spot', label: 'Missed the spot', points: 0 },
    ],
    max_score: 40,
    scaled: false,
    scaled_max: null,
    level_bands: [
      { min: 0, max: 20, label: 'Needs work' },
      { min: 21, max: 31, label: 'Decent' },
      { min: 32, max: 35, label: 'Good' },
      { min: 36, max: 40, label: 'Excellent' },
    ],
    recommendation: 'Pick the spot. Roll it over the spot.',
    is_builtin: true,
    sort_order: 15,
    scoring_mode: 'standard',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    user_id: null,
    category: 'indoor',
    name: 'Distance Ladder',
    purpose: 'Tests pace and stroke length.',
    setup: 'Set finish zones at 1 m, 1.75 m, and 2.5 m. Make each zone about 20-30 cm deep.',
    reps: 15,
    scoring_inputs: [
      { id: 'in_zone', label: 'Inside correct zone', points: 1 },
      { id: 'missed_zone', label: 'Short or long', points: 0 },
    ],
    max_score: 15,
    scaled: false,
    scaled_max: null,
    level_bands: [
      { min: 0, max: 7, label: 'Needs work' },
      { min: 8, max: 11, label: 'Decent' },
      { min: 12, max: 13, label: 'Good' },
      { min: 14, max: 15, label: 'Excellent' },
    ],
    recommendation: 'Spend the next session on same tempo with a bigger or smaller stroke.',
    is_builtin: true,
    sort_order: 20,
    scoring_mode: 'standard',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    user_id: null,
    category: 'indoor',
    name: '1 m Automatic Putts',
    purpose: 'Tests repeatable short-putt conversion.',
    setup: 'Set a straight 1 m putt to a cup, mug, putting hole, or small target.',
    reps: 20,
    scoring_inputs: [
      { id: 'made', label: 'Holed or hit target', points: 1 },
      { id: 'missed', label: 'Miss', points: 0 },
    ],
    max_score: 20,
    scaled: false,
    scaled_max: null,
    level_bands: [
      { min: 0, max: 12, label: 'Needs work' },
      { min: 13, max: 16, label: 'Decent' },
      { min: 17, max: 18, label: 'Good' },
      { min: 19, max: 20, label: 'Excellent' },
    ],
    recommendation: 'Keep the same routine and start it straight from 1 m.',
    is_builtin: true,
    sort_order: 30,
    scoring_mode: 'standard',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    user_id: null,
    category: 'indoor',
    name: 'Putter Gate Stroke',
    purpose: 'Tests clean stroke path and centred contact.',
    setup: 'Set two objects just wider than your putter head. Place the ball in the middle. Putt from 1.5 m.',
    reps: 20,
    scoring_inputs: [
      { id: 'clean_holed', label: 'Clean stroke, holed putt', points: 2 },
      { id: 'clean_miss', label: 'Clean stroke, miss', points: 1 },
      { id: 'hit_gate', label: 'Hit the gate', points: 0 },
    ],
    max_score: 40,
    scaled: false,
    scaled_max: null,
    level_bands: [
      { min: 0, max: 20, label: 'Needs work' },
      { min: 21, max: 28, label: 'Decent' },
      { min: 29, max: 34, label: 'Good' },
      { min: 35, max: 40, label: 'Excellent' },
    ],
    recommendation: 'Prioritise clean gate contact before worrying about make rate.',
    is_builtin: true,
    sort_order: 40,
    scoring_mode: 'standard',
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    user_id: null,
    category: 'indoor',
    name: 'Around-the-Clock Short Putts',
    purpose: 'Tests short putts from different angles.',
    setup: 'Place 4 balls around a hole/cup/target at 1 m. Repeat the full circle 5 times.',
    reps: 20,
    scoring_inputs: [
      { id: 'made', label: 'Holed or hit target', points: 1 },
      { id: 'missed', label: 'Miss', points: 0 },
    ],
    max_score: 20,
    scaled: false,
    scaled_max: null,
    level_bands: [
      { min: 0, max: 12, label: 'Needs work' },
      { min: 13, max: 16, label: 'Decent' },
      { min: 17, max: 18, label: 'Good' },
      { min: 19, max: 20, label: 'Excellent' },
    ],
    recommendation: 'Use the same routine across different looks at the same distance.',
    is_builtin: true,
    sort_order: 50,
    scoring_mode: 'standard',
  },
  {
    id: '66666666-6666-4666-8666-666666666666',
    user_id: null,
    category: 'indoor',
    name: 'Leapfrog Lag Putting',
    purpose: 'Tests touch and small distance changes.',
    setup: 'Start from 1 m. Each ball must finish past the previous ball but inside the 2.5 m end boundary.',
    reps: 10,
    scoring_inputs: [
      { id: 'successful_leap', label: 'Past previous, inside boundary', points: 1 },
      { id: 'failed_leap', label: 'Short of previous or past 2.5 m', points: 0 },
    ],
    max_score: 10,
    scaled: false,
    scaled_max: null,
    level_bands: [
      { min: 0, max: 4, label: 'Needs work' },
      { min: 5, max: 7, label: 'Decent' },
      { min: 8, max: 9, label: 'Good' },
      { min: 10, max: 10, label: 'Excellent' },
    ],
    recommendation: 'Practise landing the ball just past the previous finish.',
    is_builtin: true,
    sort_order: 60,
    scoring_mode: 'standard',
  },
  {
    id: '77777777-7777-4777-8777-777777777777',
    user_id: null,
    category: 'indoor',
    name: 'Random Distance Call',
    purpose: 'Tests changing distance on demand.',
    setup: 'Set finish zones at 1 m, 1.75 m, and 2.5 m. Randomly call the target before each putt.',
    reps: 15,
    scoring_inputs: [
      { id: 'called_zone', label: 'Finished in called zone', points: 1 },
      { id: 'missed_called_zone', label: 'Missed called zone', points: 0 },
    ],
    max_score: 15,
    scaled: false,
    scaled_max: null,
    level_bands: [
      { min: 0, max: 7, label: 'Needs work' },
      { min: 8, max: 11, label: 'Decent' },
      { min: 12, max: 13, label: 'Good' },
      { min: 14, max: 15, label: 'Excellent' },
    ],
    recommendation: 'Rehearse see it, feel it, roll it before each changed distance.',
    is_builtin: true,
    sort_order: 70,
    scoring_mode: 'standard',
  },
  {
    id: '88888888-8888-4888-8888-888888888888',
    user_id: null,
    category: 'indoor',
    name: 'Pressure Ladder',
    purpose: 'Tests make rate when the score matters.',
    setup: 'Putts at 0.5 m, 1 m, 1.5 m, 2 m, and 2.5 m. Hole it to move back; miss and go back one step.',
    reps: 1,
    scoring_inputs: [
      { id: 'level_0', label: 'No level completed', points: 0 },
      { id: 'level_1', label: '0.5 m completed', points: 1 },
      { id: 'level_2', label: '1 m completed', points: 2 },
      { id: 'level_3', label: '1.5 m completed', points: 3 },
      { id: 'level_4', label: '2 m completed', points: 4 },
      { id: 'level_5', label: '2.5 m completed', points: 5 },
    ],
    max_score: 5,
    scaled: false,
    scaled_max: null,
    level_bands: [
      { min: 0, max: 2, label: 'Needs work' },
      { min: 3, max: 3, label: 'Decent' },
      { min: 4, max: 4, label: 'Good' },
      { min: 5, max: 5, label: 'Excellent' },
    ],
    recommendation: 'Slow down the routine and treat each putt as a single full commitment.',
    is_builtin: true,
    sort_order: 80,
    scoring_mode: 'pressure_ladder',
  },
];

const extraDrills: PuttingDrill[] = [
  makeDrill('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Blast Tempo Baseline', 'Tempo', 'Measure a repeatable putting rhythm without chasing a perfect number.', 'Hit 10 putts from 1.5 m with Blast Motion. Use your normal routine.', 10, 'both', ['tempo', 'routine'], ['Blast Motion'], 'Keep your rhythm stable around a natural 2:1 pattern.', 90),
  makeDrill('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'Blast Tempo Ladder', 'Tempo transfer', 'Keep the same rhythm as stroke length changes.', 'Hit 5 putts each from 1 m, 3 m, and 6 m. Record Blast metrics after the set.', 15, 'both', ['tempo', 'pace'], ['Blast Motion'], 'Same rhythm, different stroke length.', 100),
  makeDrill('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'Quiet Hands Drill', 'Stroke control', 'Build a shoulder-driven stroke with soft grip pressure.', 'Hit 10 putts from 1 m. Use Blast Motion if available.', 10, 'both', ['tempo', 'strike'], ['Blast Motion'], 'Quiet hands. Hold the finish.', 110),
  makeDrill('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', '3-6-9 m Ladder', 'Pace', 'Calibrate speed across three useful outdoor distances.', 'Putt 3 balls each from 3 m, 6 m, and 9 m. Score balls inside 60 cm.', 9, 'outdoor', ['pace', 'lag'], ['Balls', 'Tees'], 'Same tempo. Let stroke length change.', 120),
  makeDrill('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'Long Lag Circle', 'Lag control', 'Reduce three-putt risk from long range.', 'Hit 5 balls from 9-12 m. Score balls finishing inside a 90 cm circle.', 5, 'outdoor', ['pace', 'lag'], ['Balls', 'Tees'], 'Look longer at the target. Die it into the circle.', 130),
  makeDrill('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', '1 m Circle', 'Conversion', 'Build short-putt confidence around the hole.', 'Place 8 balls around the hole at 1 m. Score makes.', 8, 'outdoor', ['conversion', 'pressure'], ['Balls'], 'Face first. Firm inside 1 m.', 140),
  makeDrill('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7', '1.5 m Circle', 'Pressure conversion', 'Test conversion when the putt is no longer automatic.', 'Place 8 balls around the hole at 1.5 m. Score makes.', 8, 'outdoor', ['conversion', 'pressure'], ['Balls'], 'Commit to the start spot.', 150),
  makeDrill('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8', 'Entry Point Drill', 'Green reading', 'Link read, entry point, start line, and pace.', 'Choose 8 breaking putts. Call the entry point before each stroke.', 8, 'outdoor', ['reading', 'pace'], ['Balls'], 'Read the finish, then build the line back.', 160),
  makeDrill('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9', 'Par-18 Putting', 'Scoring test', 'Benchmark your outdoor putting transfer.', 'Play 9 different holes on the practice green. Par is 2 on each.', 18, 'outdoor', ['pressure', 'routine', 'pace'], ['Ball'], 'One ball. Full routine. Accept the result.', 170),
  makeDrill('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10', 'Random One-Ball Test', 'Course transfer', 'Practise the rhythm of real putting rather than block repetition.', 'Play 9 different putts with one ball and a full routine.', 9, 'outdoor', ['routine', 'reading', 'pressure'], ['Ball'], 'Read it, commit, roll it.', 180),
];

function makeDrill(
  id: string,
  name: string,
  purpose: string,
  detail: string,
  setup: string,
  reps: number,
  location: 'indoor' | 'outdoor' | 'both',
  skillTags: string[],
  equipment: string[],
  cue: string,
  sortOrder: number,
): PuttingDrill {
  return {
    id,
    user_id: null,
    category: location === 'indoor' ? 'indoor' : 'outdoor',
    name,
    purpose: `${purpose}: ${detail}`,
    setup,
    reps,
    scoring_inputs: [
      { id: 'successful', label: 'Successful rep', points: 1 },
      { id: 'missed', label: 'Miss', points: 0 },
    ],
    max_score: reps,
    scaled: false,
    scaled_max: null,
    level_bands: [
      { min: 0, max: Math.floor(reps * 0.49), label: 'Needs work' },
      { min: Math.ceil(reps * 0.5), max: Math.floor(reps * 0.69), label: 'Developing' },
      { min: Math.ceil(reps * 0.7), max: Math.floor(reps * 0.89), label: 'Good' },
      { min: Math.ceil(reps * 0.9), max: reps, label: 'Strong' },
    ],
    recommendation: cue,
    is_builtin: true,
    sort_order: sortOrder,
    scoring_mode: 'standard',
    location,
    skill_tags: skillTags,
    difficulty: 'developing',
    time_minutes: Math.max(5, Math.ceil(reps / 3)),
    equipment,
    best_for: skillTags,
    progression: 'Add distance, reduce the target, or use one ball with a full routine.',
    regression: 'Shorten the putt or widen the target until the movement feels repeatable.',
    blast_compatible: equipment.includes('Blast Motion') || skillTags.includes('tempo'),
    cue_cards: [cue],
    common_fault: 'Chasing the result instead of committing to the routine.',
    quick_fix: cue,
  };
}

function enrichDrill(drill: PuttingDrill): PuttingDrill {
  const skill = drill.name.includes('Distance') || drill.name.includes('Lag') || drill.name.includes('Random')
    ? ['pace']
    : drill.name.includes('Pressure') || drill.name.includes('Automatic') || drill.name.includes('Clock')
      ? ['conversion']
      : ['start line', 'strike'];
  return {
    ...drill,
    location: drill.location || 'indoor',
    skill_tags: drill.skill_tags || skill,
    difficulty: drill.difficulty || 'developing',
    time_minutes: drill.time_minutes || Math.max(5, Math.ceil(drill.reps / 3)),
    equipment: drill.equipment || ['Balls', 'Tees or coins'],
    best_for: drill.best_for || skill,
    progression: drill.progression || 'Narrow the target or add distance.',
    regression: drill.regression || 'Widen the target or shorten the putt.',
    blast_compatible: drill.blast_compatible ?? true,
    cue_cards: drill.cue_cards || [drill.recommendation || 'Commit to the start spot.'],
    common_fault: drill.common_fault || 'Losing the routine when the score matters.',
    quick_fix: drill.quick_fix || drill.recommendation,
  };
}

export const LOCKED_INDOOR_DRILLS: PuttingDrill[] = baseDrills.map(enrichDrill);
export const PRODUCT_PUTTING_DRILLS: PuttingDrill[] = [...LOCKED_INDOOR_DRILLS, ...extraDrills.map(enrichDrill)];

export const INDOOR_PRACTICE_SETS = [
  {
    id: 'set-a',
    name: 'Set A - Start Line + Short Makes',
    description: 'Face aim, start direction, clean stroke, and short-putt conversion under pressure.',
    drillNames: ['Start-Line Gate', 'Spot Roll Drill', 'Putter Gate Stroke', '1 m Automatic Putts'],
  },
  {
    id: 'set-b',
    name: 'Set B - Pace + Touch',
    description: 'Distance control, touch, and adapting to different short putts.',
    drillNames: ['Distance Ladder', 'Leapfrog Lag Putting', 'Random Distance Call', 'Around-the-Clock Short Putts'],
  },
  {
    id: 'set-c',
    name: 'Set C - Stroke + Transfer',
    description: 'Balanced technique check without getting too technical.',
    drillNames: ['Spot Roll Drill', 'Putter Gate Stroke', 'Random Distance Call', 'Pressure Ladder'],
  },
  {
    id: 'full',
    name: 'Full Putting Test',
    description: 'Run the whole home putting battery.',
    drillNames: LOCKED_INDOOR_DRILLS.map(drill => drill.name),
  },
] as const;

export type IndoorPracticeSetId = (typeof INDOOR_PRACTICE_SETS)[number]['id'];

export interface PuttingPracticeSet {
  id: string;
  name: string;
  description: string;
  category: PuttingSessionType;
  drillNames: string[];
  timeMinutes: number;
  bestFor: string;
}

export const PUTTING_PRACTICE_SETS: PuttingPracticeSet[] = [
  ...INDOOR_PRACTICE_SETS.map((set) => ({ ...set, category: set.id === 'full' ? 'benchmark' as const : 'indoor' as const, timeMinutes: set.id === 'full' ? 30 : 20, bestFor: set.id === 'full' ? 'Monthly benchmark' : 'Indoor practice' })),
  { id: 'set-d', name: 'Set D - Blast Motion Stroke Lab', description: 'Measure tempo, rhythm, and stroke consistency by set.', category: 'blast', drillNames: ['Blast Tempo Baseline', 'Blast Tempo Ladder', 'Quiet Hands Drill', '1 m Automatic Putts'], timeMinutes: 25, bestFor: 'Tempo and technique' },
  { id: 'outdoor-speed', name: 'Outdoor Speed Control', description: 'Calibrate pace and reduce three-putt risk.', category: 'outdoor', drillNames: ['3-6-9 m Ladder', 'Long Lag Circle', 'Random One-Ball Test'], timeMinutes: 25, bestFor: 'Pace and lag putting' },
  { id: 'outdoor-conversion', name: 'Short-Putt Conversion', description: 'Build confidence and conversion around the hole.', category: 'outdoor', drillNames: ['1 m Circle', '1.5 m Circle', 'Pressure Ladder'], timeMinutes: 20, bestFor: 'Short putts under pressure' },
  { id: 'outdoor-reading', name: 'Green Reading Builder', description: 'Match entry point, start spot, and speed.', category: 'outdoor', drillNames: ['Entry Point Drill', 'Random One-Ball Test'], timeMinutes: 20, bestFor: 'Green reading' },
  { id: 'benchmark-short', name: 'Putting Skills Test - Short', description: 'A repeatable 10-12 minute benchmark.', category: 'benchmark', drillNames: ['Start-Line Gate', '1 m Automatic Putts', '3-6-9 m Ladder', 'Pressure Ladder'], timeMinutes: 12, bestFor: 'Quick benchmark' },
  { id: 'benchmark-full', name: 'Putting Skills Test - Full', description: 'A complete indoor and outdoor putting profile.', category: 'benchmark', drillNames: ['Start-Line Gate', 'Putter Gate Stroke', '3-6-9 m Ladder', 'Long Lag Circle', '1 m Circle', '1.5 m Circle', 'Pressure Ladder'], timeMinutes: 30, bestFor: 'Monthly benchmark' },
  { id: 'warmup-5', name: '5-Minute Emergency Warm-Up', description: 'Speed check, start line, then finish with makes.', category: 'warmup', drillNames: ['Long Lag Circle', '1 m Circle'], timeMinutes: 5, bestFor: 'Fast pre-round calibration' },
  { id: 'warmup-10', name: '10-Minute Standard Warm-Up', description: 'Green speed, lag feel, start line, short confidence, and one-ball rehearsal.', category: 'warmup', drillNames: ['3-6-9 m Ladder', 'Start-Line Gate', '1 m Circle', 'Random One-Ball Test'], timeMinutes: 10, bestFor: 'Normal pre-round routine' },
  { id: 'warmup-15', name: '15-Minute Tournament Warm-Up', description: 'A fuller calibration without score-chasing.', category: 'warmup', drillNames: ['3-6-9 m Ladder', 'Entry Point Drill', '1 m Circle', 'Random One-Ball Test'], timeMinutes: 15, bestFor: 'Competition preparation' },
];

export type PuttingPracticeSetId = string;

export const DRILL_METRIC_WEIGHTS: Record<string, Partial<Record<PuttingMetric, number>>> = {
  'Start-Line Gate': { startLineStrike: 1 },
  'Spot Roll Drill': { startLineStrike: 0.7, conversionPressure: 0.3 },
  'Distance Ladder': { paceTouch: 1 },
  '1 m Automatic Putts': { conversionPressure: 0.8, startLineStrike: 0.2 },
  'Putter Gate Stroke': { startLineStrike: 0.7, conversionPressure: 0.3 },
  'Around-the-Clock Short Putts': { conversionPressure: 1 },
  'Leapfrog Lag Putting': { paceTouch: 1 },
  'Random Distance Call': { paceTouch: 1 },
  'Pressure Ladder': { conversionPressure: 1 },
};

export function mergeLockedIndoorDrills(remoteDrills: PuttingDrill[]): PuttingDrill[] {
  const lockedIds = new Set(PRODUCT_PUTTING_DRILLS.map(drill => drill.id));
  const unlockedRemote = remoteDrills.filter(drill => !drill.is_builtin && !lockedIds.has(drill.id));
  return [...PRODUCT_PUTTING_DRILLS, ...unlockedRemote.map(enrichDrill)].sort((a, b) => a.sort_order - b.sort_order);
}
