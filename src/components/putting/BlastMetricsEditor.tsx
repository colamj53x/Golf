import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BlastMetricKey, BlastMotionSetData } from '@/types/putting';
import { scoreBlastMechanics } from '@/lib/putting/blastScoring';

interface Props {
  value?: BlastMotionSetData;
  onSave: (next: BlastMotionSetData) => Promise<void> | void;
  saveLabel?: string;
  disabled?: boolean;
}

const fields: Array<[BlastMetricKey, string, string]> = [
  ['tempo_ratio', 'Tempo ratio', '0.1'],
  ['backstroke_time', 'Backstroke sec', '0.01'],
  ['forwardstroke_time', 'Forward sec', '0.01'],
  ['total_stroke_time', 'Total stroke sec', '0.01'],
  ['backstroke_length', 'Backstroke length', '0.1'],
  ['impact_stroke_speed', 'Impact stroke speed', '0.1'],
  ['face_angle_at_impact', 'Face angle at impact', '0.1'],
  ['backstroke_rotation', 'Backstroke rotation', '0.1'],
  ['forwardstroke_rotation', 'Forward stroke rotation', '0.1'],
  ['lie_loft_change', 'Lie / loft change', '0.1'],
];

function withLegacyAverages(value?: BlastMotionSetData): BlastMotionSetData {
  if (!value) return {};
  const metric_ranges = { ...value.metric_ranges };
  if (!metric_ranges.backstroke_length && value.stroke_length !== undefined) metric_ranges.backstroke_length = { average: value.stroke_length };
  if (!metric_ranges.face_angle_at_impact && value.face_rotation !== undefined) metric_ranges.face_angle_at_impact = { average: value.face_rotation };
  for (const [field] of fields) {
    if (!metric_ranges[field] && value[field] !== undefined) metric_ranges[field] = { average: value[field] };
  }
  return { ...value, metric_ranges };
}

export function BlastMetricsEditor({ value, onSave, saveLabel = 'Save Blast metrics', disabled = false }: Props) {
  const [draft, setDraft] = useState<BlastMotionSetData>(() => withLegacyAverages(value));
  const [saving, setSaving] = useState(false);
  const mechanics = scoreBlastMechanics(draft);

  useEffect(() => setDraft(withLegacyAverages(value)), [value]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-sky-200 bg-white/80 p-3">
      <div>
        <div className="text-sm font-semibold text-sky-950">Blast Motion metrics</div>
        <p className="text-xs text-sky-800">Enter the minimum, average and maximum shown by Blast Motion. Leave unavailable fields blank.</p>
      </div>
      {mechanics && (
        <div className="rounded-md border border-sky-200 bg-sky-50 p-3">
          <div className="text-xs font-semibold uppercase text-sky-800">Blast Mechanics Score</div>
          <div className="mt-1 text-2xl font-bold text-sky-950">{mechanics.score}<span className="text-sm font-normal text-sky-800"> / 100</span></div>
          <p className="mt-1 text-xs text-sky-800">{mechanics.summary} Based on {mechanics.metricsUsed} entered metric{mechanics.metricsUsed === 1 ? '' : 's'}.</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="grid min-w-[620px] grid-cols-[minmax(160px,1fr)_repeat(3,minmax(110px,0.7fr))] gap-2">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Metric</div>
          {['Minimum', 'Average', 'Maximum'].map(label => <div key={label} className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>)}
          {fields.map(([field, label, step]) => (
            <div key={field} className="contents">
              <Label className="self-center">{label}</Label>
              {(['min', 'average', 'max'] as const).map(bound => (
                <Input
                  key={bound}
                  type="number"
                  step={step}
                  value={draft.metric_ranges?.[field]?.[bound] ?? ''}
                  onChange={event => setDraft(current => ({
                    ...current,
                    metric_ranges: {
                      ...current.metric_ranges,
                      [field]: {
                        ...current.metric_ranges?.[field],
                        [bound]: event.target.value === '' ? null : Number(event.target.value),
                      },
                    },
                  }))}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-1">
        <Label>Notes</Label>
        <Textarea
          value={draft.notes || ''}
          onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))}
          placeholder="Optional notes about this Blast Motion set."
          rows={2}
        />
      </div>
      <Button type="button" size="sm" disabled={disabled || saving} onClick={handleSave}>
        {saving ? 'Saving...' : saveLabel}
      </Button>
    </div>
  );
}
