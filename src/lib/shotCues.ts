import { useEffect, useState } from 'react';

export const SHOT_CUES_STORAGE_KEY = 'golf_shot_cues_v1';
export const SHOT_CUES_CHANGED_EVENT = 'golf-shot-cues-changed';

export type ShotCueId = 'driver' | 'wood_hybrid' | 'iron_6_7' | 'iron_8_9' | 'punch' | 'bump' | 'pitch' | 'chip';

export interface ShotCueCard {
  id: ShotCueId;
  title: string;
  appliesTo: string;
  goal: string;
  preShot: string;
  setup: string;
  look: string;
  swing: string;
  fullClock?: string;
  halfClock?: string;
  courseCue: string;
}

export interface ResolvedShotCue extends ShotCueCard {
  configKey: string;
  clock?: string;
}

export const DEFAULT_SHOT_CUES: ShotCueCard[] = [
  { id: 'driver', title: 'Driver', appliesTo: 'Driver · Full', goal: 'Clubface first. Right foot back. Inside-back of ball. Lead arm long. Slight draw, strong launch, balanced finish.', preShot: 'Pick the target and start-line spot. Picture a gentle draw. Make one smooth rehearsal.', setup: 'Clubface first. Match the grip Vs. Right foot half-to-full shoe back. Ball inside lead heel. Small trail-side tilt.', look: 'Inside-back quadrant of the ball.', swing: 'Smooth wide takeaway. Natural hinge. Lead side starts as the arms fall inside. Sweep through with the lead arm long.', courseCue: 'Face first. Right foot back. Inside-back. Sweep it. Lead arm long.' },
  { id: 'wood_hybrid', title: '5 Wood / Hybrid', appliesTo: '5W, 4H, 5H · Full', goal: 'Clubface first. Right foot slightly back. Brush through for a climbing, playable flight.', preShot: 'Pick target and start line. Picture the climbing flight. Make one sweeping rehearsal.', setup: 'Clubface first. Match the grip Vs. Right foot quarter-to-half shoe back. Ball slightly forward. Pressure inside the toes and toward lead side.', look: 'Outside-right of the ball and just forward.', swing: 'Smooth wide turn. Natural hinge. Lead side starts as the arms fall inside. Brush through with the lead arm long.', courseCue: 'Face first. Right foot slightly back. Slightly outside-right/forward. Brush through.' },
  { id: 'iron_6_7', title: '6 / 7 Iron Full', appliesTo: '6I, 7I · Full', goal: 'Clubface first. Right foot slightly back. Ball then turf. Lead arm long.', preShot: 'Pick target and start line. Picture the flight. Make one ball-first rehearsal.', setup: 'Clubface first. Match the grip Vs. Right foot quarter-to-half shoe back. Ball centre to slightly forward. Pressure inside toes and lead side.', look: 'Grass outside-right just after the ball.', swing: 'Smooth turn and natural hinge. Lead side starts. Strike ball then turf and keep the lead arm long.', courseCue: 'Face first. Right foot slightly back. Grass outside-right after ball. Ball then turf.' },
  { id: 'iron_8_9', title: '8 / 9 Iron Full', appliesTo: '8I, 9I · Full', goal: 'Clubface first. Right foot slightly back. Ball then turf. Controlled flight.', preShot: 'Pick target and start line. Picture the flight. Make one ball-first brushing rehearsal.', setup: 'Clubface first. Match the grip Vs. Right foot a small step back. Ball centre. Pressure inside toes and lead side.', look: 'Front-inside of the ball or grass slightly forward and outside-right.', swing: 'Smooth turn and natural hinge. Lead side starts. Brush through with the lead arm long.', courseCue: 'Face first. Right foot slightly back. Front-inside / forward grass. Brush through.' },
  { id: 'punch', title: 'Punch Iron', appliesTo: '6I, 7I · Punch · Full', goal: 'Clubface first. Lead side. Hands ahead. Compact 9 o’clock swing and low flight.', preShot: 'Pick target and low window. Make one compact 9 o’clock rehearsal.', setup: 'Clubface first. Right foot quarter-to-half shoe back. Ball centre to back. Handle ahead. Pressure inside toes and lead side.', look: 'Front of the ball or grass forward and outside-right.', swing: 'Small hinge. Lead side starts. Ball first, then turn through low with the lead arm long.', courseCue: 'Face first. Lead side. Hands ahead. 9 o’clock. Turn through low.' },
  { id: 'bump', title: 'Bump', appliesTo: '8I, 9I · Bump · Full or Half', goal: 'Choose the landing spot. Grip down. Separate the hands. Keep the wrists quiet and let it roll.', preShot: 'Choose landing spot, then target. Picture the roll. Make one brushing rehearsal.', setup: 'Face to landing spot. Grip down with separated hands. Narrow stance, right foot slightly back, ball middle-to-back, handle ahead.', look: 'Front of the ball or grass just ahead.', swing: 'Putting-style motion. No hinge. Move the chest, brush the grass and let the ball roll.', fullClock: '8 o’clock', halfClock: '7 o’clock', courseCue: 'Landing spot. Grip down. Separate hands. Quiet wrists. Brush and roll.' },
  { id: 'pitch', title: 'Wedge Pitch', appliesTo: 'PW, GW, SW · Pitch · Full or Half', goal: 'Choose the landing spot. Soft hands. Use the bounce and brush under the ball.', preShot: 'Choose landing spot and final target. Picture the flight. Make one brushing rehearsal.', setup: 'Face to landing spot. Match the grip Vs. Right foot slightly back. Ball centre. Handle neutral or slightly ahead.', look: 'Normal/soft lie: bottom or under the ball. Firm lie: bottom-front or just after it.', swing: 'Soft hinge, chest through, use the bounce and finish to the intended size.', fullClock: '9–10 o’clock with fuller hinge', halfClock: '8 o’clock with smaller hinge', courseCue: 'Landing spot. Soft hands. Use bounce. Brush under. Chest through.' },
  { id: 'chip', title: 'Wedge Chip', appliesTo: 'PW, GW, SW · Chip · Full or Half', goal: 'Choose the landing spot. Stand close. Toe down. Strike from the toe and putt it.', preShot: 'Choose landing spot and final target. Picture first bounce and roll. Make one putting rehearsal.', setup: 'Face to landing spot. Stand close, grip down, separate the hands and set the toe down. Narrow stance, ball middle-to-back, handle ahead.', look: 'Front of the ball or grass just ahead.', swing: 'Putting motion with no hinge. Move the chest, make a toe strike, land it and let it roll.', fullClock: '7:30–8 o’clock', halfClock: '7 o’clock', courseCue: 'Landing spot. Stand close. Toe down. Toe strike. Putt it.' },
];

function readCards(): ShotCueCard[] {
  try {
    const stored = JSON.parse(localStorage.getItem(SHOT_CUES_STORAGE_KEY) || 'null');
    if (!Array.isArray(stored)) return DEFAULT_SHOT_CUES;
    return DEFAULT_SHOT_CUES.map(defaultCard => ({ ...defaultCard, ...(stored.find((card: ShotCueCard) => card.id === defaultCard.id) ?? {}) }));
  } catch { return DEFAULT_SHOT_CUES; }
}

export function saveShotCues(cards: ShotCueCard[]) {
  localStorage.setItem(SHOT_CUES_STORAGE_KEY, JSON.stringify(cards));
  window.dispatchEvent(new Event(SHOT_CUES_CHANGED_EVENT));
  void import('@/lib/durableLocalSettings').then(({ persistDurableLocalSettingsSoon }) => persistDurableLocalSettingsSoon());
}

export function useShotCues() {
  const [cards, setCards] = useState<ShotCueCard[]>(readCards);
  useEffect(() => {
    const refresh = () => setCards(readCards());
    window.addEventListener(SHOT_CUES_CHANGED_EVENT, refresh);
    window.addEventListener('golf-durable-local-settings-hydrated', refresh);
    return () => { window.removeEventListener(SHOT_CUES_CHANGED_EVENT, refresh); window.removeEventListener('golf-durable-local-settings-hydrated', refresh); };
  }, []);
  return cards;
}

export function cueIdForConfig(configKey: string): ShotCueId | null {
  const [club, shot, power] = configKey.split('_');
  if (club === 'dr' && shot === 'full' && power === 'full') return 'driver';
  if (['5w', '4h', '5h'].includes(club) && shot === 'full' && power === 'full') return 'wood_hybrid';
  if (['6i', '7i'].includes(club) && shot === 'full' && power === 'full') return 'iron_6_7';
  if (['8i', '9i'].includes(club) && shot === 'full' && power === 'full') return 'iron_8_9';
  if (['6i', '7i'].includes(club) && shot === 'punch' && power === 'full') return 'punch';
  if (['8i', '9i'].includes(club) && shot === 'bump' && ['full', '9pm'].includes(power)) return 'bump';
  if (['pw', 'gw', 'sw'].includes(club) && shot === 'pitch' && ['full', '9pm'].includes(power)) return 'pitch';
  if (['pw', 'gw', 'sw'].includes(club) && shot === 'chip' && ['full', '9pm'].includes(power)) return 'chip';
  return null;
}

export function resolveShotCue(cards: ShotCueCard[], configKey: string): ResolvedShotCue | null {
  const id = cueIdForConfig(configKey);
  if (!id) return null;
  const card = cards.find(candidate => candidate.id === id);
  if (!card) return null;
  const power = configKey.split('_')[2];
  return { ...card, configKey, clock: power === 'full' ? card.fullClock : power === '9pm' ? card.halfClock : undefined };
}

export function shotCueLink(configKey: string): string {
  const id = cueIdForConfig(configKey);
  return id ? `/play/cues?cue=${id}&config=${encodeURIComponent(configKey)}` : '/play/cues';
}
