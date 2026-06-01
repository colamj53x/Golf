import { describe, expect, it } from 'vitest';
import { scoreBlastMechanics } from './blastScoring';

describe('scoreBlastMechanics', () => {
  it('scores stable metrics inside published target windows highly', () => {
    const result = scoreBlastMechanics({
      metric_ranges: {
        tempo_ratio: { min: 1.95, average: 2, max: 2.05 },
        face_angle_at_impact: { min: -0.1, average: 0, max: 0.1 },
      },
    });
    expect(result?.score).toBeGreaterThanOrEqual(85);
    expect(result?.metricsUsed).toBe(2);
  });

  it('scores naturally variable metrics from repeatability without requiring a target', () => {
    const result = scoreBlastMechanics({
      metric_ranges: {
        impact_stroke_speed: { min: 2, average: 2.05, max: 2.1 },
      },
    });
    expect(result?.score).toBeGreaterThan(75);
  });

  it('returns no score when there are no scoreable values', () => {
    expect(scoreBlastMechanics({ metric_ranges: { tempo_ratio: {} } })).toBeNull();
  });
});
