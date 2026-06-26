import { describe, expect, it } from 'vitest';
import { DEFAULT_SHOT_CUES, cueIdForConfig, resolveShotCue } from './shotCues';

describe('shot cue power matching', () => {
  it('uses only the Full swing size for a Full pitch', () => {
    const cue = resolveShotCue(DEFAULT_SHOT_CUES, 'pw_pitch_full');
    expect(cue?.clock).toBe("9-10 o'clock with fuller natural hinge");
    expect(cue?.clock).not.toContain("8 o'clock");
    expect(cue?.technique.find(note => note.label === 'Shot description')?.text).toContain("9-10 o'clock");
  });

  it('uses only the Half swing size for a Half pitch', () => {
    const cue = resolveShotCue(DEFAULT_SHOT_CUES, 'pw_pitch_9pm');
    expect(cue?.clock).toBe("8 o'clock with smaller hinge");
    expect(cue?.clock).not.toContain('9-10');
    expect(cue?.technique.find(note => note.label === 'Shot description')?.text).toContain("8 o'clock");
  });

  it('does not fall back to a cue for an unsupported power', () => {
    expect(cueIdForConfig('dr_full_9pm')).toBeNull();
    expect(resolveShotCue(DEFAULT_SHOT_CUES, '7i_punch_9pm')).toBeNull();
  });

  it('keeps the complete technique card rather than the condensed cue', () => {
    const cue = resolveShotCue(DEFAULT_SHOT_CUES, 'dr_full_full');
    expect(cue?.technique).toHaveLength(6);
    expect(cue?.technique.map(note => note.label)).toContain('Set-up');
    expect(cue?.technique.map(note => note.label)).toContain('One cue');
  });
});
