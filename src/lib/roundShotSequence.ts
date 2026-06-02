const ROUND_SHOT_SEQUENCE_PATTERN = /\s*\[\[golf-sequence:(\d+):(\d+)\]\]\s*/g;

export function encodeRoundShotSequence(notes: string, holeNumber: number | null, shotNumber: number | null): string {
  const cleanNotes = notes.replace(ROUND_SHOT_SEQUENCE_PATTERN, ' ').trim();
  if (holeNumber === null || shotNumber === null) return cleanNotes;
  return `${cleanNotes}${cleanNotes ? ' ' : ''}[[golf-sequence:${holeNumber}:${shotNumber}]]`;
}

export function decodeRoundShotSequence(notes: string | null): {
  notes: string;
  holeNumber: number | null;
  shotNumber: number | null;
} {
  const rawNotes = notes ?? '';
  const match = [...rawNotes.matchAll(ROUND_SHOT_SEQUENCE_PATTERN)][0];
  return {
    notes: rawNotes.replace(ROUND_SHOT_SEQUENCE_PATTERN, ' ').trim(),
    holeNumber: match ? Number(match[1]) : null,
    shotNumber: match ? Number(match[2]) : null,
  };
}
