import { describe, expect, it } from 'vitest';
import { scoreBlastMechanics } from './blastScoring';
import { DEFAULT_BLAST_MOTION_TARGETS } from './blastTargetDefaults';

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

  it('uses the user-configured target range', () => {
    const targets = {
      ...DEFAULT_BLAST_MOTION_TARGETS,
      tempo_ratio: { preferredMin: 2.9, targetAverage: 3, preferredMax: 3.1, scoringMode: 'target_and_repeatability' as const },
    };
    const result = scoreBlastMechanics({ metric_ranges: { tempo_ratio: { min: 2.95, average: 3, max: 3.05 } } }, targets);
    expect(result?.score).toBeGreaterThanOrEqual(85);
  });

  it('rewards the configured target average within the preferred range', () => {
    const centered = scoreBlastMechanics({ metric_ranges: { tempo_ratio: { average: 2 } } });
    const edge = scoreBlastMechanics({ metric_ranges: { tempo_ratio: { average: 1.8 } } });
    expect(centered?.score).toBeGreaterThan(edge?.score || 0);
  });
});
