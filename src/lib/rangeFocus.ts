import { pctWithinTarget, type ShotLike } from '@/lib/practiceConsistency';
import type { MetricStatus, PracticeMetricTarget } from '@/types/practice';

export type RangeReferenceSection = 'swing' | 'outcome';

export interface RangeReferenceRow {
  section: RangeReferenceSection;
  metricId: string;
  metricName: string;
  target: string;
  latest18Pct: number | null;
  status: MetricStatus | null;
  lowLabel: string;
  lowTip: string;
  highLabel: string;
  highTip: string;
}

const SWING_METRIC_IDS = [
  'backswing_time',
  'downswing_time',
  'attack_angle',
  'launch_direction',
  'launch_angle',
  'peak_height',
  'ball_speed',
] as const;

const OUTCOME_METRIC_IDS = [
  'carry',
  'total_distance',
  'roll',
  'avg_lateral_miss',
] as const;

function statusForScore(score: number | null): MetricStatus | null {
  if (score === null) return null;
  if (score >= 80) return 'green';
  if (score >= 50) return 'amber';
  return 'red';
}

function formatTarget(metric: PracticeMetricTarget): string {
  if (!metric.targetDisplay || metric.targetDisplay === '–') return 'Reference only';
  return metric.unit ? `${metric.targetDisplay} ${metric.unit}` : metric.targetDisplay;
}

type RangeProfileKind = 'driver' | 'wood_hybrid' | 'full_iron' | 'punch' | 'bump' | 'pitch' | 'chip';

function rangeProfileKind(configKey: string): RangeProfileKind {
  const [club, shotType] = configKey.split('_');
  if (shotType === 'punch') return 'punch';
  if (shotType === 'bump') return 'bump';
  if (shotType === 'pitch') return 'pitch';
  if (shotType === 'chip') return 'chip';
  if (club === 'dr') return 'driver';
  if (['5w', '4h', '5h'].includes(club)) return 'wood_hybrid';
  return 'full_iron';
}

function correctionPair(
  lowTip: string,
  highTip: string,
  lowLabel = 'Below target',
  highLabel = 'Above target',
): Pick<RangeReferenceRow, 'lowLabel' | 'lowTip' | 'highLabel' | 'highTip'> {
  return { lowLabel, lowTip, highLabel, highTip };
}

function tipsFor(metricId: string, configKey: string): Pick<RangeReferenceRow, 'lowLabel' | 'lowTip' | 'highLabel' | 'highTip'> {
  const profile = rangeProfileKind(configKey);
  const isFullSwing = ['driver', 'wood_hybrid', 'full_iron'].includes(profile);

  switch (metricId) {
    case 'backswing_time': {
      if (isFullSwing) return correctionPair(
        'Backswing is too quick. Slow the takeaway for the first third of the swing. Let the club, arms, and body finish the backswing together before starting down. Feel like you complete the turn rather than snatching the club away.',
        'Backswing is too slow. Keep the club moving so the swing does not stall at the top. Make a smooth but continuous takeaway, then change direction without pausing for too long.',
      );
      if (profile === 'punch') return correctionPair(
        'Backswing is too quick. Make a shorter, calmer backswing and keep the hands quiet. The punch shot should feel controlled, not rushed.',
        'Backswing is too long or slow. Shorten the arm swing and keep the motion compact. The club should not travel so far back that you have to rescue the timing on the way down.',
      );
      if (profile === 'bump') return correctionPair(
        'Backswing is too quick. Use a putting-style takeaway. Let the shoulders move the club back instead of using a sharp hand action.',
        'Backswing is too long or slow. Keep the stroke compact. Match the backswing length to the size of the shot and avoid making a mini full swing.',
      );
      if (profile === 'pitch') return correctionPair(
        'Backswing is too quick. Smooth out the takeaway and let the body turn carry the arms back. Keep grip pressure light so the club does not get jabbed away.',
        'Backswing is too slow or too long. Keep the club moving and use a more committed rhythm. Do not let the backswing get so slow that the downswing becomes a hit.',
      );
      return correctionPair(
        'Backswing is too quick. Start the stroke with the chest and shoulders. Keep the wrists quiet and avoid a sudden pickup.',
        'Backswing is too long or slow. Shorten the stroke and keep it simple. Use a small, positive motion rather than a long backswing with deceleration.',
      );
    }
    case 'downswing_time': {
      if (isFullSwing) return correctionPair(
        'Downswing is too slow. Start the downswing with a clear pressure shift into the lead foot, then rotate through. Do not simply pull the club down with the arms.',
        'Downswing is too quick. Smooth the transition from the top. Feel the lower body begin first, then let the arms follow. Avoid throwing the club from the top.',
      );
      if (profile === 'punch') return correctionPair(
        'Downswing is too slow. Keep the chest turning through the ball and finish with the hands ahead. The strike should feel firm and committed.',
        'Downswing is too quick. Reduce the hit impulse. Keep the finish shorter and balanced instead of firing the hands at the ball.',
      );
      if (profile === 'bump') return correctionPair(
        'Downswing is too slow. Keep the stroke moving through impact so the club does not quit at the ball. Finish with the clubhead continuing toward the target.',
        'Downswing is too quick. Use a softer putting-style motion. Let the club brush through the ball rather than stabbing down at it.',
      );
      if (profile === 'pitch') return correctionPair(
        'Downswing is too slow. Turn through the shot and let the body carry the club to the finish. Avoid guiding the ball.',
        'Downswing is too quick. Make the transition softer. Keep the chest rotating and avoid flipping the hands to add speed.',
      );
      return correctionPair(
        'Downswing is too slow. Keep the handle moving through impact. The club should brush the ground after the ball, not stop at the ball.',
        'Downswing is too quick. Make a smoother, shorter acceleration. Avoid a jabby strike caused by the hands taking over.',
      );
    }
    case 'attack_angle':
      if (profile === 'driver') return correctionPair(
        'Attack is too downward. Tee the ball high enough, play it forward, and feel the chest stay slightly behind the ball through impact. Sweep the ball off the tee rather than hitting sharply down.',
        'Attack is too upward or shallow. Keep posture stable and rotate through the ball. Avoid hanging back so much that the club rises too early and contact moves high on the face.',
        'Too downward',
        'Too upward',
      );
      if (profile === 'wood_hybrid') return correctionPair(
        'Attack is too shallow. Shift pressure into the lead foot earlier and brush the turf after the ball. Do not try to lift the ball into the air.',
        'Attack is too steep. Check that the ball is not too far back. Stay centred, keep turning, and avoid chopping down with the arms.',
        'Too shallow',
        'Too steep',
      );
      if (profile === 'full_iron') return correctionPair(
        'Attack is too shallow. Move pressure into the lead foot before impact, keep the handle slightly ahead, and strike ball before turf.',
        'Attack is too steep. Check that the ball is not too far back. Keep the chest turning through impact and avoid a sharp arm-driven chop.',
        'Too shallow',
        'Too steep',
      );
      if (profile === 'punch') return correctionPair(
        'Attack is too shallow. Keep weight forward and hands ahead. The ball should be struck first with a lower, controlled finish.',
        'Attack is too steep. Do not trap it by chopping down. Keep the body turning and make a shallow, forward-moving divot.',
        'Too shallow',
        'Too steep',
      );
      if (profile === 'bump') return correctionPair(
        'Attack is too shallow. Keep a small amount of shaft lean and brush the ground after the ball. Avoid scooping.',
        'Attack is too steep. Use less wrist hinge and more shoulder motion. Feel like a putting stroke with a gentle brush of the turf.',
        'Too shallow',
        'Too steep',
      );
      if (profile === 'pitch') return correctionPair(
        'Attack is too shallow. Move pressure forward and let the club brush the turf after the ball. Keep the chest rotating.',
        'Attack is too steep. Soften the hands, keep the bounce interacting with the ground, and avoid driving the leading edge sharply into the turf.',
        'Too shallow',
        'Too steep',
      );
      return correctionPair(
        'Attack is too shallow. Keep the handle slightly forward and strike the ball before the turf. Do not try to lift it.',
        'Attack is too steep. Reduce wrist action and keep the chest moving. Feel the club slide or brush through impact rather than dig.',
        'Too shallow',
        'Too steep',
      );
    case 'launch_direction':
      return correctionPair(
        'Ball is starting left of the window. Set the clubface to the target first, then build the stance around the face. Do not aim the body farther right to compensate. Check that the grip is not overly strong and that the face is not closing early.',
        'Ball is starting right of the window. Set the clubface to the target first, then build the stance around the face. Do not aim the body farther left to rescue it. Check that the face is not being left open through impact.',
        'Left of window',
        'Right of window',
      );
    case 'launch_angle':
      if (profile === 'driver') return correctionPair(
        'Launch is too low. Tee the ball slightly higher, play it forward, and feel a full finish. Avoid leaning the shaft too far forward with driver.',
        'Launch is too high. Check that the tee is not excessive and contact is not too high on the face. Keep balance and rotate through instead of hanging back and adding loft.',
        'Too low',
        'Too high',
      );
      if (profile === 'wood_hybrid') return correctionPair(
        'Launch is too low. Check that the ball is not too far back. Keep enough loft on the clubface and sweep through without trying to hit down too hard.',
        'Launch is too high. Keep pressure moving forward and rotate through. Avoid adding loft with a scoop or early release.',
        'Too low',
        'Too high',
      );
      if (profile === 'full_iron') return correctionPair(
        'Launch is too low. Check that the ball is not too far back and that the hands are not excessively forward. Keep turning so the strike is compressed but not smothered.',
        'Launch is too high. Keep pressure forward, rotate through, and avoid flipping the hands under the ball.',
        'Too low',
        'Too high',
      );
      if (profile === 'punch') return correctionPair(
        'Launch is too low. You may be over-trapping it. Keep the face stable, but allow enough loft for the ball to carry. Do not drive the handle too far forward.',
        'Launch is too high. Move pressure forward, keep hands ahead, shorten the finish, and reduce any scooping or added wrist loft.',
        'Too low',
        'Too high',
      );
      if (profile === 'bump') return correctionPair(
        'Launch is too low. Check that the ball is not too far back and that the leading edge is not digging. Allow a small amount of loft to get the ball rolling cleanly.',
        'Launch is too high. Reduce wrist flick, keep the handle stable, and use more putting-style motion. The ball should pop forward and roll, not float.',
        'Too low',
        'Too high',
      );
      if (profile === 'pitch') return correctionPair(
        'Launch is too low. Keep the chest turning and avoid excessive shaft lean. Let the club\'s loft and bounce help the ball launch.',
        'Launch is too high. Keep pressure forward and rotate through. Avoid sliding the club under the ball or adding loft with the hands.',
        'Too low',
        'Too high',
      );
      return correctionPair(
        'Launch is too low. Check strike and ball position. Use a quiet wrist motion and let the club\'s loft lift the ball slightly.',
        'Launch is too high. Reduce hand flip and keep the handle moving forward. Choose less loft if the shot needs to run.',
        'Too low',
        'Too high',
      );
    case 'peak_height':
      if (profile === 'driver') return correctionPair(
        'Peak height is too low. Improve launch first: tee height, forward ball position, and centred contact. Feel the ball launch through a higher window.',
        'Peak height is too high. Check for contact too high on the face, excessive tee height, or hanging back. Rotate through and finish balanced.',
        'Too low',
        'Too high',
      );
      if (profile === 'wood_hybrid') return correctionPair(
        'Peak height is too low. Check contact quality first. Sweep the ball with stable posture and do not force it down into the turf.',
        'Peak height is too high. Flight it through a lower window by keeping pressure forward and avoiding added loft at impact.',
        'Too low',
        'Too high',
      );
      if (profile === 'full_iron') return correctionPair(
        'Peak height is too low. Check strike, launch, and ball position. Avoid excessive forward shaft lean that removes too much loft.',
        'Peak height is too high. Keep the body turning and the handle stable. Avoid scooping, flipping, or falling back through impact.',
        'Too low',
        'Too high',
      );
      if (profile === 'punch') return correctionPair(
        'Peak height is too low. Allow slightly more loft or a slightly longer finish. Do not turn the punch into a smothered shot.',
        'Peak height is too high. Move pressure forward, shorten the finish, and keep the hands ahead through impact.',
        'Too low',
        'Too high',
      );
      if (profile === 'bump') return correctionPair(
        'Peak height is too low. Make sure the club is not digging. Use a brushing strike so the ball can pop forward cleanly.',
        'Peak height is too high. Use less wrist, less loft, and more putting-style motion. Land the ball lower and let it roll.',
        'Too low',
        'Too high',
      );
      if (profile === 'pitch') return correctionPair(
        'Peak height is too low. Let the loft work. Keep grip pressure soft, maintain posture, and brush the turf rather than driving the leading edge down.',
        'Peak height is too high. Keep pressure forward and rotate through. Avoid adding loft with the hands or sliding under the ball.',
        'Too low',
        'Too high',
      );
      return correctionPair(
        'Peak height is too low. Check strike and avoid blading it. Let the club brush the grass and use the loft you selected.',
        'Peak height is too high. Reduce wrist action and choose a lower-lofted club if needed. Focus on landing spot and roll, not height.',
        'Too low',
        'Too high',
      );
    case 'ball_speed':
      if (isFullSwing) return correctionPair(
        'Ball speed is below target. Prioritise centred contact first. Keep rhythm balanced, finish the swing, and only add effort after contact quality improves.',
        'Ball speed is above target. Do not chase more speed. Keep the same rhythm and balance. Confirm that the extra speed is not creating a bigger miss or poor strike pattern.',
      );
      if (profile === 'punch') return correctionPair(
        'Ball speed is below target. Make a committed strike with pressure forward and chest turning. Do not decelerate because the shot is shorter.',
        'Ball speed is above target. Take less club or reduce swing length. Do not hit the punch so hard that it launches too high or loses control.',
      );
      if (profile === 'bump') return correctionPair(
        'Ball speed is below target. Keep the stroke moving through impact and focus on clean contact. Do not stop the club at the ball.',
        'Ball speed is above target. Shorten the stroke and soften grip pressure. Let the ball roll from a controlled strike rather than a hit.',
      );
      if (profile === 'pitch') return correctionPair(
        'Ball speed is below target. Turn through to a complete finish for the shot length. Avoid quitting with the body and flicking weakly with the hands.',
        'Ball speed is above target. Reduce swing length and keep tempo smooth. Do not overpower a scoring shot.',
      );
      return correctionPair(
        'Ball speed is below target. Keep the handle and chest moving through the ball. Strike it cleanly and finish the stroke.',
        'Ball speed is above target. Shorten the stroke and reduce hit impulse. Focus on landing spot and roll-out control.',
      );
    case 'avg_lateral_miss':
      return {
        lowLabel: 'Inside limit',
        lowTip: 'Keep the same stock shape, start line and committed finish.',
        highLabel: 'Over limit',
        highTip: 'Return attention to face aim and start line before trying to change curve.',
      };
    case 'carry':
    case 'total_distance':
      return {
        lowLabel: 'Below target',
        lowTip: 'Check centred strike and delivery first; keep tempo instead of swinging harder.',
        highLabel: 'Above target',
        highTip: 'Keep rhythm and reduce swing length or effort slightly rather than steering it.',
      };
    case 'roll':
      return {
        lowLabel: 'Below target',
        lowTip: 'Check launch and landing window; do not force extra speed into the strike.',
        highLabel: 'Above target',
        highTip: 'Use a slightly higher landing window while keeping the same rhythm.',
      };
    default:
      return {
        lowLabel: 'Below target',
        lowTip: 'Return to the profile setup and make the same balanced stock swing.',
        highLabel: 'Above target',
        highTip: 'Keep the stock rhythm and change only one setup variable at a time.',
      };
  }
}

export function buildRangeReferenceRows(
  metrics: PracticeMetricTarget[],
  shots: ShotLike[],
  configKey: string,
): RangeReferenceRow[] {
  const latest18 = shots.slice(0, 18);

  const build = (metricId: string, section: RangeReferenceSection): RangeReferenceRow | null => {
    const metric = metrics.find(candidate => candidate.id === metricId);
    if (!metric) return null;
    const latest18Pct = pctWithinTarget(
      metric.id,
      latest18,
      metric.targetMin,
      metric.targetMax,
      configKey,
    );

    return {
      section,
      metricId: metric.id,
      metricName: metric.metricName,
      target: formatTarget(metric),
      latest18Pct,
      status: statusForScore(latest18Pct),
      ...tipsFor(metric.id, configKey),
    };
  };

  return [
    ...SWING_METRIC_IDS.map(metricId => build(metricId, 'swing')),
    ...OUTCOME_METRIC_IDS.map(metricId => build(metricId, 'outcome')),
  ].filter((row): row is RangeReferenceRow => row !== null);
}
