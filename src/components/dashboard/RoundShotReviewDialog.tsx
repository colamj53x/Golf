import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shot, normalizeClubCode } from '@/types/golf';

type ReviewDraft = Pick<Shot, 'id' | 'club' | 'shotFamily' | 'swingEffort' | 'targetIntent' | 'target' | 'startLie' | 'endLie'>;

const CLUBS = ['Dr', '5W', '4H', '5H', '6I', '7I', '8I', '9I', 'PW', 'GW', 'SW'];
const SHOT_TYPES = [
  { value: 'full', label: 'Full' },
  { value: 'pitch', label: 'Pitch' },
  { value: 'chip', label: 'Chip' },
  { value: 'bump', label: 'Bump' },
  { value: 'punch', label: 'Punch' },
];
const POWERS = [{ value: 'full', label: 'Full' }, { value: '9pm', label: 'Half' }];
const TARGETS = [{ value: 'fairway', label: 'Fairway' }, { value: 'green', label: 'Green' }];

export function RoundShotReviewDialog({ open, onOpenChange, shots, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shots: Shot[];
  onSave: (updates: Array<Pick<Shot, 'id' | 'club' | 'shotFamily' | 'swingEffort' | 'targetIntent'>>) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<ReviewDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDrafts(shots.map(shot => ({
      id: shot.id,
      club: normalizeClubCode(shot.club),
      shotFamily: shot.shotFamily || 'full',
      swingEffort: shot.swingEffort || 'full',
      targetIntent: shot.targetIntent || 'fairway',
      target: shot.target,
      startLie: shot.startLie,
      endLie: shot.endLie,
    })));
  }, [open, shots]);

  const update = (id: string, values: Partial<ReviewDraft>) => {
    setDrafts(current => current.map(draft => draft.id === id ? { ...draft, ...values } : draft));
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(drafts.map(({ id, club, shotFamily, swingEffort, targetIntent }) => ({ id, club, shotFamily, swingEffort, targetIntent })));
      toast.success('Round shot classifications updated.');
      onOpenChange(false);
    } catch {
      toast.error('Could not save the round shot changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review And Adjust Round Shots</DialogTitle>
          <DialogDescription>These saved values drive both Review and Gapping. Adjust any classification that needs correcting.</DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-2 text-left">Distance</th>
                <th className="px-3 py-2 text-left">Lie</th>
                <th className="px-3 py-2 text-left">Result</th>
                <th className="px-3 py-2 text-left">Club</th>
                <th className="px-3 py-2 text-left">Shot Type</th>
                <th className="px-3 py-2 text-left">Power</th>
                <th className="px-3 py-2 text-left">Target</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map(draft => (
                <tr key={draft.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{Math.round(draft.target)}m</td>
                  <td className="px-3 py-2">{draft.startLie}</td>
                  <td className="px-3 py-2">{draft.endLie}</td>
                  <td className="px-3 py-2"><Select value={draft.club} onValueChange={club => update(draft.id, { club })}><SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger><SelectContent>{CLUBS.map(club => <SelectItem key={club} value={club}>{club}</SelectItem>)}</SelectContent></Select></td>
                  <td className="px-3 py-2"><Select value={draft.shotFamily} onValueChange={shotFamily => update(draft.id, { shotFamily })}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent>{SHOT_TYPES.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></td>
                  <td className="px-3 py-2"><Select value={draft.swingEffort} onValueChange={swingEffort => update(draft.id, { swingEffort })}><SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger><SelectContent>{POWERS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></td>
                  <td className="px-3 py-2"><Select value={draft.targetIntent} onValueChange={targetIntent => update(draft.id, { targetIntent })}><SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger><SelectContent>{TARGETS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
