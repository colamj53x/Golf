import type { ShotCueId } from '@/lib/shotCues';

export interface ShotTechniqueNote {
  label: string;
  text: string;
  fullText?: string;
  halfText?: string;
}

export const SHOT_TECHNIQUE_INTRO = [
  { label: 'Global rule', text: 'Aim the clubface first, then build the body around the face. Feet pressure is athletic through the balls and inside edges of the feet, not tipping onto the toes.' },
];

export const DEFAULT_SHOT_TECHNIQUE: Record<ShotCueId, ShotTechniqueNote[]> = {
  driver: [
    { label: 'Shot description', text: 'Full tee shot designed to launch high with a slight draw feel and finish balanced.' },
    { label: 'Set-up', text: 'Clubface aimed first at the start line. Ball inside lead heel. Right foot back half to one shoe. Front foot flared slightly more than trail foot. Athletic pressure through inside toes / inside edges of feet. Small trail-side tilt.' },
    { label: 'Look / strike focus', text: 'Look at the inside-back of the ball and feel a sweeping strike from the inside.' },
    { label: 'Swing feel', text: 'Smooth wide takeaway, natural hinge, pressure into lead side, connect trail arm with chest, then sweep through.' },
    { label: 'Finish', text: 'Lead arm long through impact, chest turns to target, driver finishes around the shoulders, balanced.' },
    { label: 'One cue', text: 'Face first, right foot back, inside-back, connect trail arm, sweep to shoulders.' },
  ],
  wood_hybrid: [
    { label: 'Shot description', text: 'Full fairway or hybrid shot designed to climb, launch cleanly, and stay playable with a slight draw feel.' },
    { label: 'Set-up', text: 'Clubface aimed first at the start line. Ball slightly forward - 5 wood more forward, hybrid just forward of middle. Right foot back quarter to half shoe. Front foot flared slightly more than trail foot. Pressure through inside toes, favouring lead side.' },
    { label: 'Look / strike focus', text: 'Look slightly outside-right and just forward of the ball. Feel the club collect the ball, then brush the turf.' },
    { label: 'Swing feel', text: 'Smooth wide turn, natural hinge, pressure into lead side, connect trail arm with chest, then brush through along the start line.' },
    { label: 'Finish', text: 'Turn fully through, lead arm long after impact, balanced finish.' },
    { label: 'One cue', text: 'Face first, right foot slightly back, outside-right, collect it, brush through.' },
  ],
  iron_6_7: [
    { label: 'Shot description', text: 'Full iron shot designed for a clean ball-first strike, controlled flight, and slight draw feel.' },
    { label: 'Set-up', text: 'Clubface aimed first at the start line. Ball centre to slightly forward - 6 iron a touch more forward than 7 iron. Right foot back quarter to half shoe. Front foot flared slightly more than trail foot. Pressure inside toes and lead side.' },
    { label: 'Look / strike focus', text: 'Look at grass slightly outside-right and just after the ball to promote ball then turf contact.' },
    { label: 'Swing feel', text: 'Smooth connected takeaway, natural hinge, pressure into lead side, connect trail arm with chest, then strike ball first and brush turf after it.' },
    { label: 'Finish', text: 'Turn fully through with lead arm long after impact and chest facing target.' },
    { label: 'One cue', text: 'Face first, right foot slightly back, grass after ball, ball then turf.' },
  ],
  iron_8_9: [
    { label: 'Shot description', text: 'Full short-iron shot designed for centred strike, controlled launch, and reliable distance.' },
    { label: 'Set-up', text: 'Clubface aimed first at the start line. Ball around centre. Right foot only slightly back - do not over-close it. Front foot flared slightly more than trail foot. Compact athletic stance with pressure inside toes and lead side.' },
    { label: 'Look / strike focus', text: 'Look at the front-inside of the ball or grass slightly forward / outside-right.' },
    { label: 'Swing feel', text: 'Smooth connected takeaway, natural hinge, pressure into lead side, connect trail arm with chest, then brush through after the ball.' },
    { label: 'Finish', text: 'Turn fully through with lead arm long and balanced chest-to-target finish.' },
    { label: 'One cue', text: 'Face first, small right foot back, front-inside, brush through.' },
  ],
  punch: [
    { label: 'Shot description', text: "Controlled low punch shot. Use about a 9 o'clock backswing, hands ahead, and a lower finish." },
    { label: 'Set-up', text: 'Clubface aimed first at the low start line. Ball centre to just back. Handle slightly ahead. Right foot back quarter to half shoe. Front foot flared slightly more than trail foot. Narrower stance, pressure inside toes and lead side.' },
    { label: 'Look / strike focus', text: 'Look at the front of the ball or grass just forward / outside-right.' },
    { label: 'Swing feel', text: 'Compact chest-led takeaway, small hinge, pressure firmly into lead side, connect trail arm with chest, then turn through low.' },
    { label: 'Finish', text: 'Shorter low finish, lead arm long, handle ahead, chest keeps rotating.' },
    { label: 'One cue', text: "Face first, lead side, hands ahead, 9 o'clock, turn through low." },
  ],
  bump: [
    { label: 'Shot description', text: "Low bump-and-run that lands early and rolls like a putt. Full bump: about 8 o'clock. Half bump: about 7 o'clock." },
    { label: 'Set-up', text: 'Clubface aimed at landing spot. Grip down. Separate hands slightly. Narrow stance. Ball middle to slightly back. Handle ahead. Right foot slightly back. Front foot flared slightly more than trail foot. Pressure inside toes, favouring lead side.' },
    { label: 'Look / strike focus', text: 'Look at the front of the ball or grass just ahead.' },
    { label: 'Swing feel', text: 'Putting-style motion. No hinge. Chest moves the club. Brush the grass and let the ball roll.' },
    { label: 'Finish', text: 'Finish slightly longer than the backswing, handle and lead arm continuing toward landing spot.' },
    { label: 'One cue', text: 'Landing spot, grip down, separate hands, quiet wrists, brush and roll.' },
  ],
  pitch: [
    { label: 'Shot description', text: "Controlled pitch using bounce and soft hands. Full pitch: 9-10 o'clock with fuller natural hinge. Half pitch: 8 o'clock with smaller hinge." },
    { label: 'Set-up', text: 'Clubface aimed at landing spot. Ball around centre. Handle neutral to slightly ahead. Feet fairly narrow. Right foot slightly back. Front foot flared slightly more than trail foot. Pressure inside toes, favouring lead side. Keep enough loft for bounce to work.' },
    { label: 'Look / strike focus', text: 'Normal or soft lie: bottom / under the ball. Firm lie: bottom-front or grass just under / after it.' },
    { label: 'Swing feel', text: 'Soft natural hinge, pressure stays lead side, chest turns through, bounce brushes under or just after the ball.' },
    { label: 'Finish', text: 'Finish length matches shot size. Chest faces target, lead arm long and soft.' },
    { label: 'One cue', text: 'Landing spot, soft hands, use bounce, brush under, chest through.' },
  ],
  chip: [
    { label: 'Shot description', text: "Simple chip that lands on the chosen spot and rolls out predictably. Full chip: 7:30-8 o'clock. Half chip: about 7 o'clock." },
    { label: 'Set-up', text: 'Clubface aimed at landing spot. Stand close and a touch taller. Grip down. Separate hands slightly. Toe down. Very narrow stance. Ball middle to slightly back. Handle ahead. Pressure inside toes, favouring lead side.' },
    { label: 'Look / strike focus', text: 'Look at the front of the ball or grass just ahead.' },
    { label: 'Swing feel', text: 'Putting motion with no hinge. Chest and shoulders move the club. Strike with the toe area and let it roll.' },
    { label: 'Finish', text: 'Finish slightly longer than backswing. Handle, chest and lead arm continue toward landing spot.' },
    { label: 'One cue', text: 'Landing spot, stand close, toe down, toe strike, putt it.' },
  ],
};

export function resolveTechniqueNotes(notes: ShotTechniqueNote[], power: string): Array<{ label: string; text: string }> {
  return notes.map(note => ({
    label: note.label,
    text: power === 'full' ? (note.fullText ?? note.text) : power === '9pm' ? (note.halfText ?? note.text) : note.text,
  })).filter(note => note.text.trim());
}
