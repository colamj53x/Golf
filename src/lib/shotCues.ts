import { useEffect, useState } from 'react';
import { DEFAULT_SHOT_TECHNIQUE, resolveTechniqueNotes, type ShotTechniqueNote } from '@/lib/shotTechniqueNotes';

export const SHOT_CUES_STORAGE_KEY = 'golf_shot_cues_v2';
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
  finish: string;
  fullClock?: string;
  halfClock?: string;
  courseCue: string;
  technique: ShotTechniqueNote[];
}

export interface ResolvedShotCue extends ShotCueCard {
  configKey: string;
  clock?: string;
}

const BASE_SHOT_CUES: Array<Omit<ShotCueCard, 'technique'>> = [
  { id: 'driver', title: 'Driver - Full', appliesTo: 'Driver - Full', goal: 'Full tee shot designed to launch high with a slight draw feel and finish balanced.', preShot: '', setup: 'Clubface aimed first at the start line. Ball inside lead heel. Right foot back half to one shoe. Front foot flared slightly more than trail foot. Athletic pressure through inside toes / inside edges of feet. Small trail-side tilt.', look: 'Look at the inside-back of the ball and feel a sweeping strike from the inside.', swing: 'Smooth wide takeaway, natural hinge, pressure into lead side, connect trail arm with chest, then sweep through.', finish: 'Lead arm long through impact, chest turns to target, driver finishes around the shoulders, balanced.', courseCue: 'Face first, right foot back, inside-back, connect trail arm, sweep to shoulders.' },
  { id: 'wood_hybrid', title: '5 Wood / Hybrid - Full', appliesTo: '5 Wood / Hybrid - Full', goal: 'Full fairway or hybrid shot designed to climb, launch cleanly, and stay playable with a slight draw feel.', preShot: '', setup: 'Clubface aimed first at the start line. Ball slightly forward - 5 wood more forward, hybrid just forward of middle. Right foot back quarter to half shoe. Front foot flared slightly more than trail foot. Pressure through inside toes, favouring lead side.', look: 'Look slightly outside-right and just forward of the ball. Feel the club collect the ball, then brush the turf.', swing: 'Smooth wide turn, natural hinge, pressure into lead side, connect trail arm with chest, then brush through along the start line.', finish: 'Turn fully through, lead arm long after impact, balanced finish.', courseCue: 'Face first, right foot slightly back, outside-right, collect it, brush through.' },
  { id: 'iron_6_7', title: '6 / 7 Iron - Full', appliesTo: '6 / 7 Iron - Full', goal: 'Full iron shot designed for a clean ball-first strike, controlled flight, and slight draw feel.', preShot: '', setup: 'Clubface aimed first at the start line. Ball centre to slightly forward - 6 iron a touch more forward than 7 iron. Right foot back quarter to half shoe. Front foot flared slightly more than trail foot. Pressure inside toes and lead side.', look: 'Look at grass slightly outside-right and just after the ball to promote ball then turf contact.', swing: 'Smooth connected takeaway, natural hinge, pressure into lead side, connect trail arm with chest, then strike ball first and brush turf after it.', finish: 'Turn fully through with lead arm long after impact and chest facing target.', courseCue: 'Face first, right foot slightly back, grass after ball, ball then turf.' },
  { id: 'iron_8_9', title: '8 / 9 Iron - Full', appliesTo: '8 / 9 Iron - Full', goal: 'Full short-iron shot designed for centred strike, controlled launch, and reliable distance.', preShot: '', setup: 'Clubface aimed first at the start line. Ball around centre. Right foot only slightly back - do not over-close it. Front foot flared slightly more than trail foot. Compact athletic stance with pressure inside toes and lead side.', look: 'Look at the front-inside of the ball or grass slightly forward / outside-right.', swing: 'Smooth connected takeaway, natural hinge, pressure into lead side, connect trail arm with chest, then brush through after the ball.', finish: 'Turn fully through with lead arm long and balanced chest-to-target finish.', courseCue: 'Face first, small right foot back, front-inside, brush through.' },
  { id: 'punch', title: '6 / 7 Iron - Punch', appliesTo: '6 / 7 Iron - Punch', goal: "Controlled low punch shot. Use about a 9 o'clock backswing, hands ahead, and a lower finish.", preShot: '', setup: 'Clubface aimed first at the low start line. Ball centre to just back. Handle slightly ahead. Right foot back quarter to half shoe. Front foot flared slightly more than trail foot. Narrower stance, pressure inside toes and lead side.', look: 'Look at the front of the ball or grass just forward / outside-right.', swing: 'Compact chest-led takeaway, small hinge, pressure firmly into lead side, connect trail arm with chest, then turn through low.', finish: 'Shorter low finish, lead arm long, handle ahead, chest keeps rotating.', courseCue: "Face first, lead side, hands ahead, 9 o'clock, turn through low." },
  { id: 'bump', title: '8 / 9 Iron - Bump - Full or Half', appliesTo: '8 / 9 Iron - Bump - Full or Half', goal: "Low bump-and-run that lands early and rolls like a putt. Full bump: about 8 o'clock. Half bump: about 7 o'clock.", preShot: '', setup: 'Clubface aimed at landing spot. Grip down. Separate hands slightly. Narrow stance. Ball middle to slightly back. Handle ahead. Right foot slightly back. Front foot flared slightly more than trail foot. Pressure inside toes, favouring lead side.', look: 'Look at the front of the ball or grass just ahead.', swing: 'Putting-style motion. No hinge. Chest moves the club. Brush the grass and let the ball roll.', finish: 'Finish slightly longer than the backswing, handle and lead arm continuing toward landing spot.', fullClock: "8 o'clock", halfClock: "7 o'clock", courseCue: 'Landing spot, grip down, separate hands, quiet wrists, brush and roll.' },
  { id: 'pitch', title: 'PW / GW / SW - Pitch - Full or Half', appliesTo: 'PW / GW / SW - Pitch - Full or Half', goal: "Controlled pitch using bounce and soft hands. Full pitch: 9-10 o'clock with fuller natural hinge. Half pitch: 8 o'clock with smaller hinge.", preShot: '', setup: 'Clubface aimed at landing spot. Ball around centre. Handle neutral to slightly ahead. Feet fairly narrow. Right foot slightly back. Front foot flared slightly more than trail foot. Pressure inside toes, favouring lead side. Keep enough loft for bounce to work.', look: 'Normal or soft lie: bottom / under the ball. Firm lie: bottom-front or grass just under / after it.', swing: 'Soft natural hinge, pressure stays lead side, chest turns through, bounce brushes under or just after the ball.', finish: 'Finish length matches shot size. Chest faces target, lead arm long and soft.', fullClock: "9-10 o'clock with fuller natural hinge", halfClock: "8 o'clock with smaller hinge", courseCue: 'Landing spot, soft hands, use bounce, brush under, chest through.' },
  { id: 'chip', title: 'PW / GW / SW - Chip - Full or Half', appliesTo: 'PW / GW / SW - Chip - Full or Half', goal: "Simple chip that lands on the chosen spot and rolls out predictably. Full chip: 7:30-8 o'clock. Half chip: about 7 o'clock.", preShot: '', setup: 'Clubface aimed at landing spot. Stand close and a touch taller. Grip down. Separate hands slightly. Toe down. Very narrow stance. Ball middle to slightly back. Handle ahead. Pressure inside toes, favouring lead side.', look: 'Look at the front of the ball or grass just ahead.', swing: 'Putting motion with no hinge. Chest and shoulders move the club. Strike with the toe area and let it roll.', finish: 'Finish slightly longer than backswing. Handle, chest and lead arm continue toward landing spot.', fullClock: "7:30-8 o'clock", halfClock: "7 o'clock", courseCue: 'Landing spot, stand close, toe down, toe strike, putt it.' },
];

export const DEFAULT_SHOT_CUES: ShotCueCard[] = BASE_SHOT_CUES.map(card => ({
  ...card,
  technique: DEFAULT_SHOT_TECHNIQUE[card.id],
}));

function readCards(): ShotCueCard[] {
  try {
    const stored = JSON.parse(localStorage.getItem(SHOT_CUES_STORAGE_KEY) || 'null');
    if (!Array.isArray(stored)) return DEFAULT_SHOT_CUES;
    return DEFAULT_SHOT_CUES.map(defaultCard => {
      const storedCard = (stored.find((card: ShotCueCard) => card.id === defaultCard.id) ?? {}) as Partial<ShotCueCard>;
      return { ...defaultCard, ...storedCard, finish: storedCard.finish ?? defaultCard.finish, technique: storedCard.technique ?? defaultCard.technique };
    });
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
  return { ...card, configKey, clock: power === 'full' ? card.fullClock : power === '9pm' ? card.halfClock : undefined, technique: resolveTechniqueNotes(card.technique, power) };
}

export function shotCueLink(configKey: string): string {
  const id = cueIdForConfig(configKey);
  return id ? `/play/cues?cue=${id}&config=${encodeURIComponent(configKey)}` : '/play/cues';
}
