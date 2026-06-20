import { describe, expect, it } from 'vitest';
import { getTargetIntentLabel } from './shotOptions';

describe('target intent labels', () => {
  it('shows canonical title-case labels regardless of stored casing', () => {
    expect(getTargetIntentLabel('fairway')).toBe('Fairway');
    expect(getTargetIntentLabel('Fairway')).toBe('Fairway');
    expect(getTargetIntentLabel('FAIRWAY')).toBe('Fairway');
    expect(getTargetIntentLabel('green')).toBe('Green');
  });
});
