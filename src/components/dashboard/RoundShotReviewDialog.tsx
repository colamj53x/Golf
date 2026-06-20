import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getShotDateKey } from '@/lib/golfCalculations';
import { normalizeClubCode, Shot } from '@/types/golf';
import { useShotProfiles } from '@/lib/shotProfiles';
import {
  CLUB_OPTIONS,
  END_LIE_OPTIONS,
  START_LIE_OPTIONS,
  ensureOption,
  getEnabledShotFamilyOptions,
  getEnabledSwingEffortOptions,
  getEnabledTargetIntentOptions,
  getPredictedShotLabel,
  getShotFamilyLabel,
  getSwingEffortLabel,
  getTargetIntentLabel,
} from '@/lib/shotOptions';

type ReviewDraft = Pick<
  Shot,
  | 'id'
  | 'club'
  | 'shotFamily'
  | 'swingEffort'
  | 'targetIntent'
  | 'target'
  | 'total'
  | 'side'
  | 'startLie'
  | 'endLie'
  | 'date'
  | 'holeNumber'
  | 'shotNumber'
> & { accepted: boolean };

type SavedDraft = Pick<Shot, 'id' | 'club' | 'shotFamily' | 'swingEffort' | 'targetIntent' | 'startLie' | 'endLie'>;

interface RoundShotReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shots: Shot[];
  onSave: (updates: SavedDraft[]) => Promise<void>;
  title?: string;
  description?: string;
  requireCompleteSequence?: boolean;
}

function sortReviewShots(shots: Shot[]): Shot[] {
  return [...shots]
    .map((shot, index) => ({ shot, index }))
    .sort((a, b) => {
      const dateDelta = getShotDateKey(b.shot.date).localeCompare(getShotDateKey(a.shot.date));
      if (dateDelta !== 0) return dateDelta;

      if (a.shot.holeNumber !== null && b.shot.holeNumber !== null) {
        return a.shot.holeNumber - b.shot.holeNumber
          || (a.shot.shotNumber ?? Number.POSITIVE_INFINITY) - (b.shot.shotNumber ?? Number.POSITIVE_INFINITY)
          || a.index - b.index;
      }

      return a.index - b.index;
    })
    .map(({ shot }) => shot);
}

export function RoundShotReviewDialog({
  open,
  onOpenChange,
  shots,
  onSave,
  title = 'Review Round Shots',
  description = 'Same review format as upload. Shots are shown in the exact order played: Hole, then Shot.',
  requireCompleteSequence = true,
}: RoundShotReviewDialogProps) {
  const shotProfiles = useShotProfiles();
  const [drafts, setDrafts] = useState<ReviewDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [clubFilter, setClubFilter] = useState('all');
  const hasCompleteSequence = shots.length > 0 && shots.every(shot => shot.holeNumber !== null && shot.shotNumber !== null);
  const canReview = !requireCompleteSequence || hasCompleteSequence;

  useEffect(() => {
    if (!open) return;
    setClubFilter('all');
    setDrafts(sortReviewShots(shots).map(shot => ({
      ...shot,
      club: normalizeClubCode(shot.club),
      shotFamily: shot.shotFamily || 'full',
      swingEffort: shot.swingEffort || 'full',
      targetIntent: shot.targetIntent || 'fairway',
      accepted: false,
    })));
  }, [open, shots]);

  const clubOptions = useMemo(() => (
    [...new Set(drafts.map(draft => draft.club).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((club) => ({
        value: club,
        label: CLUB_OPTIONS.find(option => option.value === club)?.label ?? club,
      }))
  ), [drafts]);

  const displayedDrafts = useMemo(() => (
    clubFilter === 'all' ? drafts : drafts.filter(draft => draft.club === clubFilter)
  ), [clubFilter, drafts]);

  const update = (id: string, values: Partial<ReviewDraft>) => setDrafts(current => current.map(draft => {
    if (draft.id !== id) return draft;
    const next = { ...draft, ...values };
    if (values.club || values.shotFamily || values.swingEffort) {
      const families = getEnabledShotFamilyOptions(shotProfiles, next.club, 'onCourse');
      if (families.length && !families.some((option) => option.value === next.shotFamily)) {
        next.shotFamily = families[0].value;
      }
      const efforts = getEnabledSwingEffortOptions(shotProfiles, next.club, next.shotFamily, 'onCourse');
      if (efforts.length && !efforts.some((option) => option.value === next.swingEffort)) {
        next.swingEffort = efforts[0].value;
      }
      const targets = getEnabledTargetIntentOptions(shotProfiles, next.club, next.shotFamily, next.swingEffort, 'onCourse');
      if (targets.length && !targets.some((option) => option.value === next.targetIntent)) {
        next.targetIntent = targets[0].value;
      }
    }
    return { ...next, accepted: values.accepted ?? false };
  }));

  const save = async () => {
    setSaving(true);
    try {
      await onSave(drafts.map(({ id, club, shotFamily, swingEffort, targetIntent, startLie, endLie }) => ({
        id,
        club,
        shotFamily,
        swingEffort,
        targetIntent,
        startLie,
        endLie,
      })));
      toast.success('Shot classifications updated.');
      onOpenChange(false);
    } catch {
      toast.error('Could not save the shot changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-7xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!canReview ? (
          <Alert variant="destructive">
            <AlertDescription>
              This round does not have its uploaded Hole and Shot sequence stored yet, so it cannot be reviewed in a trustworthy order. Apply the shot-sequence database update, then re-upload this round with Replace matching round dates enabled.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Club</label>
                <Select value={clubFilter} onValueChange={setClubFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clubs</SelectItem>
                    {clubOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{displayedDrafts.length}</span> shown · {drafts.length} total
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[1320px] text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Hole</th>
                    <th className="px-3 py-2 text-left">Club</th>
                    <th className="px-3 py-2 text-left">Predicted Shot</th>
                    <th className="px-3 py-2 text-left">Distance to Green</th>
                    <th className="px-3 py-2 text-left">Target Intent</th>
                    <th className="px-3 py-2 text-left">Lie From</th>
                    <th className="px-3 py-2 text-left">Lie To</th>
                    <th className="px-3 py-2 text-left">Shot Family</th>
                    <th className="px-3 py-2 text-left">Effort</th>
                    <th className="px-3 py-2 text-left">Accept</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedDrafts.map(draft => {
                    const familyOptions = ensureOption(
                      getEnabledShotFamilyOptions(shotProfiles, draft.club, 'onCourse'),
                      draft.shotFamily,
                      getShotFamilyLabel(draft.shotFamily),
                    );
                    const effortOptions = ensureOption(
                      getEnabledSwingEffortOptions(shotProfiles, draft.club, draft.shotFamily, 'onCourse'),
                      draft.swingEffort,
                      getSwingEffortLabel(draft.swingEffort),
                    );
                    const targetOptions = ensureOption(
                      getEnabledTargetIntentOptions(shotProfiles, draft.club, draft.shotFamily, draft.swingEffort, 'onCourse'),
                      draft.targetIntent,
                      getTargetIntentLabel(draft.targetIntent),
                    );

                    return (
                      <tr key={draft.id} className={`border-t align-top ${draft.accepted ? 'bg-primary/5' : ''}`}>
                        <td className="px-3 py-3 whitespace-nowrap">{getShotDateKey(draft.date)}</td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {draft.holeNumber !== null ? `${draft.holeNumber}.${draft.shotNumber ?? '-'}` : '-'}
                        </td>
                        <td className="px-3 py-3">
                          <Select value={draft.club} onValueChange={club => update(draft.id, { club })}>
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CLUB_OPTIONS.map(option => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{getPredictedShotLabel(draft.shotFamily, draft.swingEffort)}</div>
                          <div className="text-xs text-muted-foreground">Total {Math.round(draft.total)}m · Side {Math.round(draft.side)}m</div>
                        </td>
                        <td className="px-3 py-3 font-medium">{Math.round(draft.target)}m</td>
                        <td className="px-3 py-3">
                          <Select value={draft.targetIntent} onValueChange={targetIntent => update(draft.id, { targetIntent })}>
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {targetOptions.map(option => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-3">
                          <Select value={draft.startLie} onValueChange={startLie => update(draft.id, { startLie })}>
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {START_LIE_OPTIONS.map(option => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-3">
                          <Select value={draft.endLie} onValueChange={endLie => update(draft.id, { endLie })}>
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {END_LIE_OPTIONS.map(option => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-3">
                          <Select value={draft.shotFamily} onValueChange={shotFamily => update(draft.id, { shotFamily })}>
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {familyOptions.map(option => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-3">
                          <Select value={draft.swingEffort} onValueChange={swingEffort => update(draft.id, { swingEffort })}>
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {effortOptions.map(option => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-3">
                          <Button
                            variant={draft.accepted ? 'secondary' : 'outline'}
                            onClick={() => update(draft.id, { accepted: !draft.accepted })}
                          >
                            {draft.accepted ? 'Accepted' : 'Accept'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <DialogFooter>
              <Button onClick={save} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
