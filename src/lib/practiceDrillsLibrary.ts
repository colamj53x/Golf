// Practice drill library for full-swing clubs.
// Structured around a 36-ball session split:
//   - technique:  10 balls — pick ONE drill, focus on the move
//   - scorable:   20 balls — game-style, scored, tracked over time
//   - baseline:   6 balls  — quick repeatable mapping, 0/1 per ball
//
// Keys here are config keys (club_shotType_power), matching the rest of the app.
// PRACTICE_CLUBS uses 'dr' for Driver, so the key is 'dr_full_full'.

import { parsePracticeConfigKey } from '@/types/practiceClubs';


export type DrillKind = 'technique' | 'scorable' | 'baseline';
export type DrillLevel = 'beginner' | 'advanced';

export const SESSION_BALL_SPLIT = {
  technique: 10,
  scorable: 20,
  baseline: 6,
} as const;

export interface TechniqueDrill {
  id: string;
  kind: 'technique';
  name: string;
  level?: DrillLevel;
  focus: string;          // what it sorts out
  setup: string;          // how to set up
  reps: string;           // suggested reps within the 10-ball block
  cue: string;            // the key feel/cue
  description?: string;   // longer explainer
  // Metrics this drill is intended to move (e.g. "Smash Factor", "Carry consistency").
  metricsAddressed?: string[];
  // Tags used to prioritise from practice logs (e.g. "start_line", "carry", "strike").
  fixes?: string[];
}

export interface ScorableDrill {
  id: string;
  kind: 'scorable';
  name: string;
  level?: DrillLevel;
  description: string;
  balls: number;          // always 20 for the session block
  maxScore: number;
  scoring: string;
  pass: number;
  metricsAddressed?: string[];
  fixes?: string[];
}

export interface BaselineDrill {
  id: string;
  kind: 'baseline';
  name: string;
  level?: DrillLevel;
  what: string;
  setup: string;
  scoring: string;        // each ball 0/1 — out of 6
  description?: string;
  metricsAddressed?: string[];
  fixes?: string[];
}

export type Drill = TechniqueDrill | ScorableDrill | BaselineDrill;

export interface ConfigDrills {
  technique: TechniqueDrill[];
  scorable: ScorableDrill[];
  baseline: BaselineDrill[];
}

// Driver — Normal — Full power  (key: dr_full_full)
const DRIVER_FULL_FULL: ConfigDrills = {
  technique: [
    {
      id: 'drv_tech_tee_height',
      kind: 'technique',
      name: 'Tee-height ladder',
      focus: 'Strike location and angle of attack — fixes low/heel strikes and a steep delivery.',
      description:
        'Run 10 balls in three blocks: 3 low tee (ball just clear of grass), 4 normal tee (half ball above crown), 3 high tee (full ball above crown). Low tees force you to stay in posture and centre the strike; high tees force you to tilt away and sweep up. The middle block is your real stock tee — you should feel a noticeable difference in launch and smash between blocks. By ball 10 you should have re-grooved a slightly upward, centre-face strike. Not scored — feel only. If you cannot feel the ladder, slow down and exaggerate chest tilt on the high tees.',
      setup: '3 low tee, 4 normal, 3 high tee. Same ball position (off lead heel) throughout. No target pressure — focus on contact sound and flight window.',
      reps: '10 balls — warm-up only, not scored.',
      cue: 'Sweep up through impact — chest tilted slightly away at strike.',
      metricsAddressed: ['Smash Factor', 'Carry distance', 'Strike location', 'Launch Angle'],
      fixes: ['strike', 'carry'],
    },
    {
      id: 'drv_tech_step_drill',
      kind: 'technique',
      name: 'Step drill',
      focus: 'Sequencing and pressure shift — fixes early upper-body unwind and over-the-top.',
      description:
        'Start with feet together, ball off where your lead heel would be. As the club starts back, step your lead foot out to its normal width, plant, then swing through. The step forces the lower body to lead the downswing so the club drops to the inside instead of being thrown over the top. Use this when your driver curve is wild or you are starting balls left with a snap-hook tendency. 10 balls at about 80% — sequencing matters more than speed. Not scored.',
      setup: 'Feet together at address, ball off lead heel. Step lead foot out as you start back, then complete the swing.',
      reps: '10 balls — warm-up only, not scored.',
      cue: 'Step → coil → fire. Hands stay passive until lead foot is planted.',
      metricsAddressed: ['Club path', 'Curve / side spin', 'Start line', 'Lateral dispersion'],
      fixes: ['curve', 'start_line'],
    },
    {
      id: 'drv_tech_alignment_gate',
      kind: 'technique',
      name: 'Alignment gate',
      focus: 'Face-to-path control — kills wild starts.',
      description:
        'Place two tees about one club-length in front of the ball, gap roughly 1.5 ball widths, aimed exactly down your intended start line. Hit 10 balls trying to launch each through the gate — not at the target in the distance. The gate gives instant feedback on face angle at separation: clip the inside tee and the face was open; clip the outside tee and it was closed. Pair with the step drill if path is also an issue. Use when start line is wandering more than a club length either side. Not scored.',
      setup: 'Two tees ~1 club length in front of the ball, gap ~1.5 ball widths, aimed at your start line.',
      reps: '10 balls — warm-up only, not scored.',
      cue: 'Commit to the gate, not the target.',
      metricsAddressed: ['Face angle', 'Start line', 'Lateral dispersion'],
      fixes: ['start_line', 'offline'],
    },
    {
      id: 'drv_tech_pause_top',
      kind: 'technique',
      name: 'Pause-at-top',
      focus: 'Transition tempo — kills the snatch from the top.',
      description:
        'Make a normal driver swing but hold the top of your backswing for a full one-second count before starting down. The pause kills any rush from the top, stops casting, and lets the lower body initiate. Expect to feel slow — the ball will still go normal distance because sequence beats effort. Use when smash factor has slipped, curve is unpredictable, or you know you have been quick on the course. 10 balls at full count. Not scored.',
      setup: 'Normal driver swing, hold the top a full 1-second count before starting down.',
      reps: '10 balls — warm-up only, not scored.',
      cue: '"One-Mississippi" at the top, unwind from the ground up.',
      metricsAddressed: ['Tempo', 'Smash Factor', 'Curve / side spin', 'Backswing/Downswing time'],
      fixes: ['tempo', 'curve'],
    },
  ],
  scorable: [
    {
      id: 'drv_score_fairway_game',
      kind: 'scorable',
      name: 'Virtual fairway game',
      description:
        '20 balls played as if on the course. Picture a 30-yard wide fairway on the range and judge every ball honestly against it. 2 points if the ball finishes in the fairway with your committed shape, 1 if it leaks into rough but is playable, 0 for a penalty/lost-ball miss or a dead pull/block. Full pre-shot routine on every ball — no rapid-fire. Default scorable when you want a single number to track tee-shot reliability week over week. Pass mark 28/40 (70%).',
      balls: 20,
      maxScore: 40,
      scoring:
        '2 pts: in fairway and committed shape. 1 pt: in rough but playable. 0: penalty / lost / dead pull or block.',
      pass: 28,
      metricsAddressed: ['Fairways hit %', 'Lateral dispersion', 'Curve / side spin'],
    },
    {
      id: 'drv_score_shape_call',
      kind: 'scorable',
      name: 'Call your shape',
      description:
        '20 balls. Before each swing call draw, fade, or straight out loud. You only score if the ball both matches the called shape AND finishes in your imagined fairway. Stops you grading on flight alone — you have to own face and path. Mix the calls (do not just call your favourite shape). Best for weeks when curve numbers are erratic or when you want to prove you can work the ball both ways on demand. Pass mark 12/20 (60%).',
      balls: 20,
      maxScore: 20,
      scoring: '1 pt per ball that matches the called shape and finds the fairway. 0 otherwise.',
      pass: 12,
      metricsAddressed: ['Curve / side spin', 'Face angle', 'Shot shape control', 'Start line'],
    },
    {
      id: 'drv_score_par4_sim',
      kind: 'scorable',
      name: 'Par-4 simulator',
      description:
        '20 balls = 10 par-4 holes × 2 attempts each (or 20 different holes from a course you know). For each tee shot decide outcome AND what approach club it would leave. 2 points if the ball is in play AND it leaves your stock approach club; 1 if in play but on an awkward club or lie; 0 if you would have to reload. Forces position over distance — closer to actual scoring than the fairway game. Pass 28/40.',
      balls: 20,
      maxScore: 40,
      scoring:
        '2 pts: in play AND stock approach club. 1 pt: in play but awkward club/lie. 0: out of play / reload.',
      pass: 28,
      metricsAddressed: ['Fairways hit %', 'Carry distance', 'Shot quality', 'Course management'],
    },
    {
      id: 'drv_score_first_tee',
      kind: 'scorable',
      name: 'First-tee pressure',
      description:
        '20 single-ball reps. Full pre-shot routine, walk away between every ball, treat each one as the first tee of a tournament. No grouping shots, no quick re-hits. 1 point per ball that finds your imagined fairway under one-ball pressure. Most honest measure of whether your driver works when it matters — the only ball that counts on the course is the first one. Pass 12/20.',
      balls: 20,
      maxScore: 20,
      scoring: '1 pt per ball that finds your imagined fairway under one-ball pressure.',
      pass: 12,
      metricsAddressed: ['Fairways hit %', 'Pre-shot routine consistency', 'Mental performance'],
    },
  ],
  baseline: [],

};

// Registry. Driver is live; other clubs/shots will be added.
export const PRACTICE_DRILLS_BY_CONFIG: Record<string, ConfigDrills> = {
  dr_full_full: DRIVER_FULL_FULL,
};

// =====================================================
// Global technique drill library — pulled from the user's
// drills.xlsx. Each entry declares which clubs and shot
// types it applies to so getDrillsForConfig can surface
// the right warm-up techniques for every club, not just
// the driver. Edit later in the Drill Bank.
// =====================================================

interface GlobalTechniqueDrill extends TechniqueDrill {
  clubs: string[];      // PracticeClubId values
  shotTypes: string[];  // ShotTypeId values
}

const ALL_FULL_SWING_CLUBS = ['dr', '5w', '4h', '5h', '6i', '7i', '8i', '9i', 'pw', 'gw', 'sw'];

function gDrill(
  id: string,
  name: string,
  focus: string,
  description: string,
  clubs: string[],
  shotTypes: string[],
  metricsAddressed: string[] = [],
  fixes: string[] = [],
): GlobalTechniqueDrill {
  return {
    id,
    kind: 'technique',
    name,
    level: 'beginner',
    focus,
    description,
    setup: description,
    cue: 'See drill description — edit this cue once you have a feel that works.',
    reps: '10 balls — warm-up only, not scored.',
    metricsAddressed,
    fixes,
    clubs,
    shotTypes,
  };
}

const GLOBAL_TECHNIQUE_DRILLS: GlobalTechniqueDrill[] = [
  gDrill('gd_towel_behind', 'Towel Behind Ball Drill',
    'Fat shots / excessive steepness',
    'Place a towel 10–15 cm behind the ball. Make swings without touching the towel. Focus on brushing the turf after the ball. Trains shallower delivery and proper low point control.',
    ['sw', 'pw', '9i'], ['full', 'pitch'],
    ['Strike location', 'Attack Angle'], ['strike', 'attack_angle']),
  gDrill('gd_feet_together', 'Feet Together Swings',
    'Loss of balance and over-swinging',
    'Hit balls with feet touching. Forces centred rotation, balance and sequencing. Excellent for tempo and reducing lateral sway.',
    ['6i', '7i', '8i', '9i', 'pw', 'gw', 'sw'], ['full'],
    ['Tempo', 'Smash Factor', 'Strike location'], ['tempo', 'strike']),
  gDrill('gd_pump_transition', 'Pump Transition Drill',
    'Over-the-top move',
    'Swing to the top, pause, rehearse the first move down slowly three times, then hit. Feel hands dropping while body rotates.',
    ['dr', '5w', '4h', '5h', '6i', '7i', '8i', '9i'], ['full'],
    ['Club path', 'Curve / side spin'], ['curve', 'start_line']),
  gDrill('gd_split_grip', 'Split Grip Drill',
    'Early release / flipping',
    'Separate hands by 8–10 cm on the grip. Make slow swings feeling shaft lean and body rotation controlling the strike.',
    ['sw', 'gw', 'pw', '6i', '7i', '8i', '9i'], ['full'],
    ['Strike location', 'Launch Angle'], ['strike', 'launch_angle']),
  gDrill('gd_lead_arm_only', 'Lead Arm Only Swings',
    'Poor strike sequencing',
    'Hit short shots using only lead arm. Encourages body rotation and centred contact without hand manipulation.',
    ['sw', 'gw', 'pw', '8i', '9i'], ['full', 'pitch'],
    ['Strike location', 'Smash Factor'], ['strike']),
  gDrill('gd_trail_arm_only', 'Trail Arm Only Swings',
    'Poor clubface control',
    'Use trail arm only to feel clubhead delivery and bounce interaction. Helps with release timing.',
    ['sw', 'gw', 'pw', '8i', '9i'], ['pitch', 'chip'],
    ['Face angle', 'Strike location'], ['start_line']),
  gDrill('gd_alignment_gate', 'Alignment Stick Gate',
    'Pushes/pulls from path issues',
    'Put two alignment sticks just wider than clubhead through impact zone. Swing through gate without touching sticks.',
    ALL_FULL_SWING_CLUBS, ['full'],
    ['Club path', 'Start line'], ['start_line', 'curve']),
  gDrill('gd_pause_at_top', 'Pause at Top Drill',
    'Rushed transition',
    'Pause for one second at top before downswing. Builds sequencing and eliminates aggressive transition.',
    ['dr', '6i', '7i', '8i', '9i'], ['full'],
    ['Tempo', 'Smash Factor'], ['tempo']),
  gDrill('gd_9_to_3', '9-to-3 Drill',
    'Inconsistent contact',
    'Swing from lead-arm-parallel to lead-arm-parallel. Focus on centred strike and turf interaction.',
    ['sw', 'gw', 'pw', '6i', '7i', '8i', '9i'], ['full', 'pitch'],
    ['Strike location', 'Smash Factor'], ['strike']),
  gDrill('gd_impact_bag', 'Impact Bag Drill',
    'Weak impact structure',
    'Hit an impact bag or pillow at slow speed. Train flat lead wrist, shaft lean and body rotation through impact.',
    ['sw', 'gw', 'pw', '6i', '7i', '8i', '9i'], ['full'],
    ['Smash Factor', 'Launch Angle'], ['strike']),
  gDrill('gd_tee_line', 'Tee Line Strike Drill',
    'Heel/toe strikes',
    'Put tees outside heel and toe. Strike centre without touching tees.',
    ['6i', '7i', '8i', '9i'], ['full'],
    ['Strike location', 'Smash Factor'], ['strike']),
  gDrill('gd_one_hand_release', 'One-Hand Release Drill',
    'Locked release / open face',
    'Hit soft shots releasing trail hand off the club after impact. Encourages natural release and squaring.',
    ['dr', '5w'], ['full'],
    ['Face angle', 'Curve / side spin'], ['curve', 'start_line']),
  gDrill('gd_step_through', 'Step Through Drill',
    'Poor weight transfer',
    'Step lead foot toward target during downswing. Encourages athletic sequencing and rotation.',
    ['dr', '6i', '7i', '8i', '9i'], ['full'],
    ['Club path', 'Tempo'], ['tempo', 'curve']),
  gDrill('gd_headcover_trail', 'Headcover Under Trail Arm',
    'Disconnected arms',
    'Keep headcover under trail arm through downswing. Improves connection and body-driven motion.',
    ['sw', 'gw', 'pw', '6i', '7i', '8i', '9i'], ['full'],
    ['Strike location'], ['strike']),
  gDrill('gd_low_tee_compression', 'Low Tee Compression Drill',
    'Scooping irons',
    'Place ball on very low tee. Focus on compressing ball without sweeping upward.',
    ['6i', '7i', '8i', '9i'], ['full'],
    ['Attack Angle', 'Launch Angle', 'Smash Factor'], ['attack_angle', 'launch_angle']),
  gDrill('gd_divot_line', 'Divot Line Drill',
    'Poor low point',
    'Draw line on mat/grass. Place ball slightly ahead of line. Divot must start after line.',
    ['sw', 'gw', 'pw', '6i', '7i', '8i', '9i'], ['full', 'pitch'],
    ['Strike location', 'Attack Angle'], ['strike', 'attack_angle']),
  gDrill('gd_slow_motion', 'Slow Motion Swings',
    'Poor mechanics under speed',
    'Make ultra-slow swings stopping at checkpoints. Builds movement awareness and sequencing.',
    ALL_FULL_SWING_CLUBS, ['full', 'pitch', 'chip', 'punch', 'bump'],
    ['Tempo'], ['tempo']),
  gDrill('gd_eyes_closed', 'Eyes Closed Swings',
    'Poor balance/feel',
    'Make soft swings with eyes closed after setup. Enhances balance and swing awareness.',
    ['sw', 'gw', 'pw'], ['pitch', 'chip'],
    ['Tempo', 'Strike location'], ['tempo']),
  gDrill('gd_clock_face', 'Clock Face Wedge Drill',
    'Distance inconsistency',
    'Hit shots using 7:30, 9:00 and 10:30 backswing lengths. Record distances.',
    ['sw', 'gw', 'pw'], ['full', 'pitch'],
    ['Carry distance', 'Carry Variation'], ['carry']),
  gDrill('gd_ladder_distance', 'Ladder Distance Drill',
    'Poor wedge distance control',
    'Hit consecutive shots increasing distance by 5m each time without changing tempo dramatically.',
    ['sw', 'gw', 'pw'], ['pitch'],
    ['Carry distance', 'Carry Variation'], ['carry']),
  gDrill('gd_hover_driver', 'Hover Driver Drill',
    'Tension at setup',
    'Hover driver slightly off ground before takeaway. Improves rhythm and reduces stabbing takeaway.',
    ['dr'], ['full'],
    ['Tempo', 'Smash Factor'], ['tempo']),
  gDrill('gd_baseball', 'Baseball Swings',
    'Poor rotation',
    'Make waist-high baseball swings feeling torso rotation and release.',
    ['dr', '6i', '7i', '8i', '9i'], ['full'],
    ['Club path', 'Swing Speed'], ['curve']),
  gDrill('gd_trail_foot_back', 'Trail Foot Back Drill',
    'Slice/outside path',
    'Drop trail foot back slightly from normal stance. Encourages inside path.',
    ['dr', '5w'], ['full'],
    ['Club path', 'Curve / side spin'], ['curve', 'start_line']),
  gDrill('gd_stick_hips', 'Stick Across Hips Drill',
    'Poor rotation sequencing',
    'Put alignment stick through belt loops and rehearse hip rotation through impact.',
    ALL_FULL_SWING_CLUBS, ['full'],
    ['Tempo', 'Club path'], ['tempo']),
  gDrill('gd_bounce_brush', 'Bounce Brush Drill',
    'Digging wedges',
    'Brush grass repeatedly using bounce without taking deep divots. Trains shallow wedge delivery.',
    ['sw'], ['chip', 'pitch'],
    ['Attack Angle', 'Strike location'], ['attack_angle']),
  gDrill('gd_trail_hand_off_chips', 'Trail Hand Off Chips',
    'Deceleration in chipping',
    'Hit chips letting trail hand release naturally after impact. Promotes acceleration through strike.',
    ['sw', 'pw', '8i'], ['chip'],
    ['Tempo', 'Strike location'], ['tempo']),
  gDrill('gd_three_ball_turf', 'Three Ball Turf Drill',
    'Fat/thin strike pattern',
    'Place balls in a line 5 cm apart. Strike middle ball cleanly without touching others.',
    ['sw', 'gw', 'pw', '6i', '7i', '8i', '9i'], ['full'],
    ['Strike location'], ['strike']),
  gDrill('gd_finish_hold', 'Finish Hold Drill',
    'Poor balance & sequencing',
    'Hold finish for 3 seconds after every swing. If unstable, swing was out of sequence or overpowered.',
    ALL_FULL_SWING_CLUBS, ['full'],
    ['Tempo'], ['tempo']),
];

export function getDrillsForConfig(configKey: string): ConfigDrills | null {
  const base = PRACTICE_DRILLS_BY_CONFIG[configKey];
  let club = '';
  let shotType = '';
  try {
    ({ club, shotType } = parsePracticeConfigKey(configKey));
  } catch {
    /* ignore */
  }
  const globals: TechniqueDrill[] = GLOBAL_TECHNIQUE_DRILLS.filter(
    (d) => d.clubs.includes(club) && d.shotTypes.includes(shotType),
  );
  if (!base && globals.length === 0) return null;
  return {
    technique: [...(base?.technique ?? []), ...globals],
    scorable: base?.scorable ?? [],
    baseline: base?.baseline ?? [],
  };
}

// Default level mapping so the bank always has a level to show.
function defaultLevel(d: Drill): DrillLevel {
  if (d.kind === 'technique') return 'beginner';
  if (d.kind === 'baseline') return 'beginner';
  return 'advanced';
}

export interface DrillWithMeta {
  drill: Drill;
  level: DrillLevel;
  sourceConfigKey: string;
}

export function getAllDrills(): DrillWithMeta[] {
  const out: DrillWithMeta[] = [];
  for (const [configKey, group] of Object.entries(PRACTICE_DRILLS_BY_CONFIG)) {
    for (const d of [...group.technique, ...group.scorable, ...group.baseline]) {
      out.push({
        drill: d,
        level: d.level ?? defaultLevel(d),
        sourceConfigKey: configKey,
      });
    }
  }
  // Global techniques surface once each in the bank.
  for (const g of GLOBAL_TECHNIQUE_DRILLS) {
    out.push({
      drill: g,
      level: g.level ?? 'beginner',
      sourceConfigKey: 'global',
    });
  }
  return out;
}


