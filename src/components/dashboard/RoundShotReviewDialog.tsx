import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CLUB_CODE_MAP, normalizeClubCode, Shot } from '@/types/golf';

type ReviewDraft = Pick<Shot, 'id' | 'club' | 'shotFamily' | 'swingEffort' | 'targetIntent' | 'target' | 'total' | 'side' | 'startLie' | 'endLie'> & { accepted: boolean };
type SavedDraft = Pick<Shot, 'id' | 'club' | 'shotFamily' | 'swingEffort' | 'targetIntent' | 'startLie' | 'endLie'>;
const CLUBS = [{ value: 'Dr', label: 'Driver' }, { value: '5W', label: '5 Wood' }, { value: '4H', label: '4 Hybrid' }, { value: '5H', label: '5 Hybrid' }, { value: '6I', label: '6 Iron' }, { value: '7I', label: '7 Iron' }, { value: '8I', label: '8 Iron' }, { value: '9I', label: '9 Iron' }, { value: 'PW', label: 'Pitching Wedge' }, { value: 'GW', label: 'Gap Wedge' }, { value: 'SW', label: 'Sand Wedge' }, { value: 'LW', label: 'Lob Wedge' }];
const FAMILIES = [{ value: 'full', label: 'Full' }, { value: 'punch', label: 'Punch' }, { value: 'pitch', label: 'Pitch' }, { value: 'chip', label: 'Chip' }, { value: 'bump', label: 'Bump and Run' }];
const POWERS = [{ value: 'full', label: 'Full' }, { value: '9pm', label: 'Half' }];
const TARGETS = [{ value: 'fairway', label: 'Fairway' }, { value: 'green', label: 'Green' }];
const START_LIES = ['Tee', 'Fairway', 'Rough', 'Recovery', 'Sand', 'Green'];
const END_LIES = ['Fairway', 'Rough', 'Recovery', 'Sand', 'Green', 'Fringe', 'Hole', 'Penalty', 'Water', 'OB'];
const label = (options: Array<{ value: string; label: string }>, value: string) => options.find(option => option.value === value)?.label ?? value;
const familiesForClub = (club: string) => {
  const id = (CLUB_CODE_MAP[club] ?? CLUB_CODE_MAP[club.toUpperCase()] ?? club).toLowerCase();
  if (['dr', '5w', '4h', '5h'].includes(id)) return FAMILIES.filter(option => option.value === 'full');
  if (['6i', '7i'].includes(id)) return FAMILIES.filter(option => option.value === 'full' || option.value === 'punch');
  if (['8i', '9i'].includes(id)) return FAMILIES.filter(option => option.value === 'full' || option.value === 'bump');
  return FAMILIES.filter(option => ['full', 'pitch', 'chip'].includes(option.value));
};

export function RoundShotReviewDialog({ open, onOpenChange, shots, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; shots: Shot[]; onSave: (updates: SavedDraft[]) => Promise<void> }) {
  const [drafts, setDrafts] = useState<ReviewDraft[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setDrafts(shots.map(shot => ({ ...shot, club: normalizeClubCode(shot.club), shotFamily: shot.shotFamily || 'full', swingEffort: shot.swingEffort || 'full', targetIntent: shot.targetIntent || 'fairway', accepted: false }))); }, [open, shots]);
  const update = (id: string, values: Partial<ReviewDraft>) => setDrafts(current => current.map(draft => draft.id === id ? { ...draft, ...values, accepted: values.accepted ?? false } : draft));
  const save = async () => {
    setSaving(true);
    try {
      await onSave(drafts.map(({ id, club, shotFamily, swingEffort, targetIntent, startLie, endLie }) => ({ id, club, shotFamily, swingEffort, targetIntent, startLie, endLie })));
      toast.success('Round shot classifications updated.'); onOpenChange(false);
    } catch { toast.error('Could not save the round shot changes.'); } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[85vh] max-w-6xl overflow-y-auto"><DialogHeader><DialogTitle>Review Round Shots</DialogTitle><DialogDescription>Same review format as upload. Adjust the saved shot classification and result fields, then save.</DialogDescription></DialogHeader><div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[1080px] text-sm"><thead className="bg-muted/60"><tr><th className="px-3 py-2 text-left">Club</th><th className="px-3 py-2 text-left">Predicted Shot</th><th className="px-3 py-2 text-left">Distance to Target</th><th className="px-3 py-2 text-left">Target Intent</th><th className="px-3 py-2 text-left">Start Lie</th><th className="px-3 py-2 text-left">End Lie</th><th className="px-3 py-2 text-left">Shot Family</th><th className="px-3 py-2 text-left">Effort</th><th className="px-3 py-2 text-left">Accept</th></tr></thead><tbody>{drafts.map(draft => <tr key={draft.id} className={`border-t align-top ${draft.accepted ? 'bg-primary/5' : ''}`}><td className="px-3 py-3"><Select value={draft.club} onValueChange={club => update(draft.id, { club })}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent>{CLUBS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></td><td className="px-3 py-3"><div className="font-medium">{label(FAMILIES, draft.shotFamily)} · {label(POWERS, draft.swingEffort)}</div><div className="text-xs text-muted-foreground">Total {Math.round(draft.total)}m • Side {Math.round(draft.side)}m</div></td><td className="px-3 py-3 font-medium">{Math.round(draft.target)}m</td><td className="px-3 py-3"><Select value={draft.targetIntent} onValueChange={targetIntent => update(draft.id, { targetIntent })}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent>{TARGETS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></td><td className="px-3 py-3"><Select value={draft.startLie} onValueChange={startLie => update(draft.id, { startLie })}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent>{START_LIES.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></td><td className="px-3 py-3"><Select value={draft.endLie} onValueChange={endLie => update(draft.id, { endLie })}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent>{END_LIES.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></td><td className="px-3 py-3"><Select value={draft.shotFamily} onValueChange={shotFamily => update(draft.id, { shotFamily })}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent>{familiesForClub(draft.club).map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></td><td className="px-3 py-3"><Select value={draft.swingEffort} onValueChange={swingEffort => update(draft.id, { swingEffort })}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent>{POWERS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></td><td className="px-3 py-3"><Button variant={draft.accepted ? 'secondary' : 'outline'} onClick={() => update(draft.id, { accepted: !draft.accepted })}>{draft.accepted ? 'Accepted' : 'Accept'}</Button></td></tr>)}</tbody></table></div><DialogFooter><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button></DialogFooter></DialogContent></Dialog>;
}
