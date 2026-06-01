import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScanSearch } from 'lucide-react';
import { toast } from 'sonner';
import { BlastMotionSetData } from '@/types/putting';
import { BLAST_METRIC_FIELDS, extractBlastMetrics } from '@/lib/putting/blastExtraction';

interface Props {
  value?: BlastMotionSetData;
  onSave: (next: BlastMotionSetData) => Promise<void> | void;
  saveLabel?: string;
  disabled?: boolean;
}

export function BlastMetricsEditor({ value, onSave, saveLabel = 'Apply reviewed metrics', disabled = false }: Props) {
  const [draft, setDraft] = useState<BlastMotionSetData>(value || {});
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const screenshots = value?.screenshot_data_urls || [];

  useEffect(() => setDraft(value || {}), [value]);

  const handleRead = async () => {
    if (!screenshots.length) return;
    setReading(true);
    try {
      const extracted = await extractBlastMetrics(screenshots);
      setDraft(current => ({ ...current, ...extracted }));
      toast.success('Blast metrics read. Please review them before saving.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read the Blast screenshots.');
    } finally {
      setReading(false);
    }
  };

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-sky-950">Blast metric review</div>
          <p className="text-xs text-sky-800">Read all screenshots together, then correct any suggestion before saving.</p>
        </div>
        <div className="flex items-center gap-2">
          {draft.extraction_confidence && <Badge variant="outline">{draft.extraction_confidence} confidence</Badge>}
          <Button type="button" size="sm" variant="outline" disabled={disabled || reading || screenshots.length === 0} onClick={handleRead}>
            <ScanSearch className="mr-1 h-4 w-4" /> {reading ? 'Reading...' : 'Read screenshots'}
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {BLAST_METRIC_FIELDS.map(([field, label, step]) => (
          <div key={field} className="grid gap-1">
            <Label>{label}</Label>
            <Input
              type="number"
              step={step}
              value={draft[field] ?? ''}
              onChange={event => setDraft(current => ({ ...current, [field]: event.target.value === '' ? null : Number(event.target.value) }))}
            />
          </div>
        ))}
      </div>
      <div className="grid gap-1">
        <Label>Extraction notes</Label>
        <Textarea
          value={draft.extraction_notes || ''}
          onChange={event => setDraft(current => ({ ...current, extraction_notes: event.target.value }))}
          placeholder="The image reader will flag uncertain or missing values here."
          rows={2}
        />
      </div>
      <Button type="button" size="sm" disabled={disabled || saving} onClick={handleSave}>
        {saving ? 'Saving...' : saveLabel}
      </Button>
    </div>
  );
}
