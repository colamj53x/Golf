import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBlastMotionTargets } from '@/lib/putting/blastTargets';
import { BLAST_MOTION_TARGET_METRICS, BlastMotionTargets, DEFAULT_BLAST_MOTION_TARGETS } from '@/lib/putting/blastTargetDefaults';

function numberValue(value: string): number | null {
  return value === '' ? null : Number(value);
}

export function BlastMotionTargetsCard() {
  const { targets, loading, saveTargets } = useBlastMotionTargets();
  const [draft, setDraft] = useState<BlastMotionTargets>(targets);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(targets), [targets]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveTargets(draft);
      toast.success('Blast Motion targets saved across devices');
    } catch {
      toast.error('Failed to save Blast Motion targets');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card id="settings-blast-targets" className="scroll-mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Blast Motion Targets</CardTitle>
        <CardDescription>These targets drive the separate Blast Mechanics Score. They save to your account and sync across devices.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <div className="grid min-w-[820px] grid-cols-[minmax(180px,1.2fr)_repeat(3,minmax(110px,0.7fr))_minmax(190px,1fr)] gap-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Metric</div>
            {['Preferred Min', 'Target Average', 'Preferred Max', 'Scoring Mode'].map(label => <div key={label} className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>)}
          {BLAST_MOTION_TARGET_METRICS.map(({ key, label, step }) => (
              <div key={key} className="contents">
                <Label className="self-center">{label}</Label>
                {(['preferredMin', 'targetAverage', 'preferredMax'] as const).map(field => (
                  <Input key={field} type="number" step={step} value={draft[key][field] ?? ''} onChange={event => setDraft(current => ({ ...current, [key]: { ...current[key], [field]: numberValue(event.target.value) } }))} />
                ))}
                <Select value={draft[key].scoringMode} onValueChange={value => setDraft(current => ({ ...current, [key]: { ...current[key], scoringMode: value as typeof current[typeof key]['scoringMode'] } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="target_and_repeatability">Target + repeatability</SelectItem>
                    <SelectItem value="repeatability_only">Repeatability only</SelectItem>
                    <SelectItem value="off">Do not score</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Use repeatability-only for metrics where the right absolute value changes with putt length. Leave optional values blank if you have not set a personal target yet.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={saving || loading}>{saving ? 'Saving...' : 'Save Blast Targets'}</Button>
          <Button variant="outline" onClick={() => setDraft(DEFAULT_BLAST_MOTION_TARGETS)} disabled={saving}>Restore suggested defaults</Button>
        </div>
      </CardContent>
    </Card>
  );
}
