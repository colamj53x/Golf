import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { LevelBand, ScoringInput } from '@/types/putting';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: 'indoor' | 'outdoor';
  onSaved: () => void;
}

export function DrillBuilderDialog({ open, onOpenChange, category, onSaved }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [setup, setSetup] = useState('');
  const [reps, setReps] = useState(20);
  const [maxScore, setMaxScore] = useState(20);
  const [scaled, setScaled] = useState(false);
  const [scaledMax, setScaledMax] = useState(20);
  const [recommendation, setRecommendation] = useState('');
  const [inputs, setInputs] = useState<ScoringInput[]>([
    { id: 'made', label: 'Made', points: 1 },
    { id: 'missed', label: 'Missed', points: 0 },
  ]);
  const [bands, setBands] = useState<LevelBand[]>([
    { min: 0, max: 10, label: 'Needs Work' },
    { min: 11, max: 15, label: 'Bronze' },
    { min: 16, max: 18, label: 'Silver' },
    { min: 19, max: 20, label: 'Gold' },
  ]);
  const [saving, setSaving] = useState(false);

  const addInput = () => setInputs([...inputs, { id: `opt_${inputs.length + 1}`, label: '', points: 0 }]);
  const removeInput = (i: number) => setInputs(inputs.filter((_, idx) => idx !== i));
  const updateInput = (i: number, patch: Partial<ScoringInput>) => {
    setInputs(inputs.map((inp, idx) => (idx === i ? { ...inp, ...patch } : inp)));
  };

  const addBand = () => setBands([...bands, { min: 0, max: 0, label: '' }]);
  const removeBand = (i: number) => setBands(bands.filter((_, idx) => idx !== i));
  const updateBand = (i: number, patch: Partial<LevelBand>) => {
    setBands(bands.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('Sign in to save drills');
      return;
    }

    if (!name.trim()) {
      toast.error('Drill name is required');
      return;
    }
    if (inputs.length === 0 || inputs.some(i => !i.label.trim() || !i.id.trim())) {
      toast.error('All scoring options need an id and label');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('putting_drills').insert({
      user_id: user.id,
      category,
      name: name.trim().slice(0, 80),
      purpose: purpose.trim().slice(0, 500) || null,
      setup: setup.trim().slice(0, 500) || null,
      reps,
      scoring_inputs: JSON.parse(JSON.stringify(inputs)),
      max_score: maxScore,
      scaled,
      scaled_max: scaled ? scaledMax : null,
      level_bands: JSON.parse(JSON.stringify(bands)),
      recommendation: recommendation.trim().slice(0, 500) || null,
      is_builtin: false,
      sort_order: 99,
    });
    setSaving(false);
    if (error) {
      toast.error('Failed to save drill');
      return;
    }
    toast.success('Drill created');
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Custom Drill</DialogTitle>
          <DialogDescription>Build your own scored drill with tap counters.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} maxLength={80} />
          </div>
          <div className="grid gap-2">
            <Label>Purpose</Label>
            <Textarea value={purpose} onChange={e => setPurpose(e.target.value)} maxLength={500} rows={2} />
          </div>
          <div className="grid gap-2">
            <Label>Setup</Label>
            <Textarea value={setup} onChange={e => setSetup(e.target.value)} maxLength={500} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Reps (total)</Label>
              <Input type="number" min={1} max={200} value={reps} onChange={e => setReps(Number(e.target.value))} />
            </div>
            <div className="grid gap-2">
              <Label>Max raw score</Label>
              <Input type="number" min={1} value={maxScore} onChange={e => setMaxScore(Number(e.target.value))} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Scale to smaller max?</Label>
              <p className="text-xs text-muted-foreground">e.g. raw 48 → scaled 20 (for session total)</p>
            </div>
            <Switch checked={scaled} onCheckedChange={setScaled} />
          </div>
          {scaled && (
            <div className="grid gap-2">
              <Label>Scaled max</Label>
              <Input type="number" min={1} value={scaledMax} onChange={e => setScaledMax(Number(e.target.value))} />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Scoring buttons</Label>
              <Button type="button" variant="outline" size="sm" onClick={addInput}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            {inputs.map((inp, i) => (
              <div key={i} className="grid grid-cols-[1fr_2fr_80px_auto] gap-2 items-center">
                <Input placeholder="id" value={inp.id} onChange={e => updateInput(i, { id: e.target.value })} />
                <Input placeholder="Label" value={inp.label} onChange={e => updateInput(i, { label: e.target.value })} />
                <Input type="number" placeholder="pts" value={inp.points} onChange={e => updateInput(i, { points: Number(e.target.value) })} />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeInput(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Level bands (against {scaled ? 'scaled' : 'raw'} score)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addBand}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            {bands.map((b, i) => (
              <div key={i} className="grid grid-cols-[80px_80px_1fr_auto] gap-2 items-center">
                <Input type="number" placeholder="min" value={b.min} onChange={e => updateBand(i, { min: Number(e.target.value) })} />
                <Input type="number" placeholder="max" value={b.max} onChange={e => updateBand(i, { max: Number(e.target.value) })} />
                <Input placeholder="Label" value={b.label} onChange={e => updateBand(i, { label: e.target.value })} />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeBand(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="grid gap-2">
            <Label>Recommendation if weakest</Label>
            <Textarea value={recommendation} onChange={e => setRecommendation(e.target.value)} maxLength={500} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Drill'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
