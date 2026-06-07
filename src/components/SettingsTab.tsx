import { useEffect, useMemo, useState } from 'react';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, ChevronDown, ChevronRight, Goal, Phone, Save, Settings as SettingsIcon, Pencil, SlidersHorizontal, Plus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Toggle } from '@/components/ui/toggle';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PRACTICE_CLUBS, SHOT_TYPES, POWER_OPTIONS, parsePracticeConfigKey } from '@/types/practiceClubs';
import {
  clubFullNormalRuleKey,
  isClubFullNormalClassification,
  saveShotClassificationRules,
  shotClassificationRuleKey,
  useShotClassificationRules,
  type ShotClassificationRules,
} from '@/lib/shotClassificationRules';
import { ProfileTarget, ShotProfile, updateShotProfile, useShotProfiles } from '@/lib/shotProfiles';
import { usePracticeShotsBySessions } from '@/hooks/usePracticeShotsBySessions';
import { buildCourseShotGappingAssignments } from '@/lib/gapping';
import { getClubConfigId } from '@/lib/golfCalculations';
import type { PlayingPartner } from '@/types/golf';

const SETTINGS_SECTIONS = [
  {
    href: '#settings-global',
    title: 'Global Settings',
    description: 'Calculation rules and gapping targets.',
    icon: SettingsIcon,
  },
  {
    href: '#settings-shot-profiles',
    title: 'Shot Options & Cues',
    description: 'Where shots appear and what cues they use.',
    icon: Goal,
  },
  {
    href: '#settings-playing-partners',
    title: 'Playing Partners',
    description: 'Names to attach to rounds.',
    icon: Users,
  },
  {
    href: '#settings-shot-classification',
    title: 'Shot Classification Rules',
    description: 'Distance-to-target cutoffs for Full and Half shots.',
    icon: SlidersHorizontal,
  },
];

function normalizePlayingPartner(partner: PlayingPartner): PlayingPartner {
  return {
    id: partner.id,
    name: partner.name,
    notes: partner.notes ?? '',
    hasMobileNumber: partner.hasMobileNumber === true,
    playedDates: Array.isArray(partner.playedDates)
      ? [...new Set(partner.playedDates.filter((date) => typeof date === 'string' && date.trim().length > 0))].sort((a, b) => b.localeCompare(a))
      : [],
  };
}

function latestPlayedDate(partner: PlayingPartner): string | null {
  return partner.playedDates?.[0] ?? null;
}

export function SettingsTab() {
  const {
    distanceToTargetTolerance,
    setDistanceToTargetTolerance,
    lowTargetExclusionThreshold,
    setLowTargetExclusionThreshold,
    gappingHcpTarget,
    setGappingHcpTarget,
    shotPickerDistanceTolerancePct,
    setShotPickerDistanceTolerancePct,
    practiceDistanceTolerancePct,
    setPracticeDistanceTolerancePct,
    practiceBallFlightTolerancePct,
    setPracticeBallFlightTolerancePct,
    practiceOtherTolerancePct,
    setPracticeOtherTolerancePct,
    todayRecentShotCount,
    setTodayRecentShotCount,
    playingPartners,
    setPlayingPartners,
  } = useGolfData();
  const [editingTolerance, setEditingTolerance] = useState(distanceToTargetTolerance);
  const [editingLowTargetThreshold, setEditingLowTargetThreshold] = useState(lowTargetExclusionThreshold);
  const [editingGappingHcpTarget, setEditingGappingHcpTarget] = useState(gappingHcpTarget);
  const [editingShotPickerDistanceTolerancePct, setEditingShotPickerDistanceTolerancePct] = useState(shotPickerDistanceTolerancePct);
  const [editingPracticeDistanceTolerancePct, setEditingPracticeDistanceTolerancePct] = useState(practiceDistanceTolerancePct);
  const [editingPracticeBallFlightTolerancePct, setEditingPracticeBallFlightTolerancePct] = useState(practiceBallFlightTolerancePct);
  const [editingPracticeOtherTolerancePct, setEditingPracticeOtherTolerancePct] = useState(practiceOtherTolerancePct);
  const [editingTodayRecentShotCount, setEditingTodayRecentShotCount] = useState(todayRecentShotCount);
  const [isEditing, setIsEditing] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [partnerDrafts, setPartnerDrafts] = useState<PlayingPartner[]>(playingPartners);
  const [expandedPartnerIds, setExpandedPartnerIds] = useState<Set<string>>(new Set());
  const [partnerDateDrafts, setPartnerDateDrafts] = useState<Record<string, string>>({});
  const [hasPartnerChanges, setHasPartnerChanges] = useState(false);

  useEffect(() => {
    if (hasPartnerChanges) return;
    setPartnerDrafts(playingPartners.map(normalizePlayingPartner));
  }, [hasPartnerChanges, playingPartners]);

  const updatePartnerDraft = (partnerId: string, updates: Partial<PlayingPartner>) => {
    setHasPartnerChanges(true);
    setPartnerDrafts((current) => current.map((partner) => (
      partner.id === partnerId ? normalizePlayingPartner({ ...partner, ...updates }) : partner
    )));
  };

  const addPlayedDate = (partnerId: string) => {
    const date = partnerDateDrafts[partnerId];
    if (!date) return;
    const partner = partnerDrafts.find((item) => item.id === partnerId);
    const dates = new Set(partner?.playedDates ?? []);
    dates.add(date);
    updatePartnerDraft(partnerId, { playedDates: [...dates].sort((a, b) => b.localeCompare(a)) });
    setPartnerDateDrafts((current) => ({ ...current, [partnerId]: '' }));
  };

  const removePlayedDate = (partnerId: string, date: string) => {
    const partner = partnerDrafts.find((item) => item.id === partnerId);
    updatePartnerDraft(partnerId, { playedDates: (partner?.playedDates ?? []).filter((item) => item !== date) });
  };

  const savePlayingPartners = () => {
    const seen = new Set<string>();
    const cleaned = partnerDrafts
      .map(normalizePlayingPartner)
      .filter((partner) => {
        const nameKey = partner.name.trim().toLowerCase();
        if (!nameKey || seen.has(nameKey)) return false;
        seen.add(nameKey);
        return true;
      });
    setPlayingPartners(cleaned);
    setPartnerDrafts(cleaned);
    setExpandedPartnerIds(new Set());
    setHasPartnerChanges(false);
    toast.success('Playing partners saved');
  };

  const handleSave = () => {
    setDistanceToTargetTolerance(editingTolerance);
    setLowTargetExclusionThreshold(editingLowTargetThreshold);
    setGappingHcpTarget(editingGappingHcpTarget);
    setShotPickerDistanceTolerancePct(editingShotPickerDistanceTolerancePct);
    setPracticeDistanceTolerancePct(editingPracticeDistanceTolerancePct);
    setPracticeBallFlightTolerancePct(editingPracticeBallFlightTolerancePct);
    setPracticeOtherTolerancePct(editingPracticeOtherTolerancePct);
    setTodayRecentShotCount(editingTodayRecentShotCount);
    setIsEditing(false);
    toast.success('Settings saved successfully');
  };

  const handleReset = () => {
    setEditingTolerance(distanceToTargetTolerance);
    setEditingLowTargetThreshold(lowTargetExclusionThreshold);
    setEditingGappingHcpTarget(gappingHcpTarget);
    setEditingShotPickerDistanceTolerancePct(shotPickerDistanceTolerancePct);
    setEditingPracticeDistanceTolerancePct(practiceDistanceTolerancePct);
    setEditingPracticeBallFlightTolerancePct(practiceBallFlightTolerancePct);
    setEditingPracticeOtherTolerancePct(practiceOtherTolerancePct);
    setEditingTodayRecentShotCount(todayRecentShotCount);
    setIsEditing(false);
    toast.info('Changes reverted');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SETTINGS_SECTIONS.map(section => {
          const Icon = section.icon;
          return (
            <a
              key={section.href}
              href={section.href}
              className="rounded-lg border bg-card p-4 text-card-foreground transition hover:border-primary/50 hover:shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold leading-tight">{section.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                </div>
              </div>
            </a>
          );
        })}
      </div>

      {/* Global Settings Card */}
      <Card id="settings-global" className="scroll-mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              Global Settings
            </CardTitle>
            <CardDescription>
              Configure global calculation parameters
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <Toggle 
              pressed={isEditing} 
              onPressedChange={setIsEditing}
              aria-label="Toggle editing"
              className="gap-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Toggle>
            {isEditing && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} className="gap-2">
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="todayRecentShotCount" className="whitespace-nowrap min-w-[200px]">
              Today Recent Shots
            </Label>
            <Input
              id="todayRecentShotCount"
              type="number"
              min={10}
              step={10}
              value={editingTodayRecentShotCount}
              onChange={(e) => setEditingTodayRecentShotCount(Math.max(10, Math.round(parseFloat(e.target.value) || 10)))}
              disabled={!isEditing}
              className="h-8 w-24 text-sm"
            />
            <span className="text-sm text-muted-foreground">
              Sets the most-recent-shot sample used for Today metrics and priorities
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Label htmlFor="gappingHcpTarget" className="whitespace-nowrap min-w-[200px]">
              Club Gapping HCP Target
            </Label>
            <Select
              value={editingGappingHcpTarget.toString()}
              onValueChange={(value) => setEditingGappingHcpTarget(Number(value))}
              disabled={!isEditing}
            >
              <SelectTrigger id="gappingHcpTarget" className="h-8 w-28 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 15, 20, 25].map(value => (
                  <SelectItem key={value} value={value.toString()}>{value} HCP</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              Sets the quality target for Club Gapping samples and Last 20 T
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Label htmlFor="shotPickerDistanceTolerancePct" className="whitespace-nowrap min-w-[200px]">
              Shot Picker Distance Tolerance (%)
            </Label>
            <Input
              id="shotPickerDistanceTolerancePct"
              type="number"
              value={editingShotPickerDistanceTolerancePct}
              onChange={(e) => setEditingShotPickerDistanceTolerancePct(parseFloat(e.target.value) || 0)}
              disabled={!isEditing}
              className="h-8 w-24 text-sm"
            />
            <span className="text-sm text-muted-foreground">
              Defines within-range, long, and short outcomes for the nominated Shot Picker distance
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Label htmlFor="tolerance" className="whitespace-nowrap min-w-[200px]">
              Distance-to-Target Tolerance (m)
            </Label>
            <Input
              id="tolerance"
              type="number"
              value={editingTolerance}
              onChange={(e) => setEditingTolerance(parseFloat(e.target.value) || 0)}
              disabled={!isEditing}
              className="h-8 w-24 text-sm"
            />
            <span className="text-sm text-muted-foreground">
              Shots within this range of stock distance count as "targeting the green"
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Label htmlFor="lowTargetThreshold" className="whitespace-nowrap min-w-[200px]">
              Low-Target Exclusion Threshold (%)
            </Label>
            <Input
              id="lowTargetThreshold"
              type="number"
              value={editingLowTargetThreshold}
              onChange={(e) => setEditingLowTargetThreshold(parseFloat(e.target.value) || 0)}
              disabled={!isEditing}
              className="h-8 w-24 text-sm"
            />
            <span className="text-sm text-muted-foreground">
              Exclude shots from distance calcs if target is this % below stock distance (for punches/chips)
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Label htmlFor="practiceDistanceTolerancePct" className="whitespace-nowrap min-w-[200px]">
              Practice Distance Tolerance (%)
            </Label>
            <Input
              id="practiceDistanceTolerancePct"
              type="number"
              value={editingPracticeDistanceTolerancePct}
              onChange={(e) => setEditingPracticeDistanceTolerancePct(parseFloat(e.target.value) || 0)}
              disabled={!isEditing}
              className="h-8 w-24 text-sm"
            />
            <span className="text-sm text-muted-foreground">
              Status tolerance for carry, total, and distance variation metrics
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Label htmlFor="practiceBallFlightTolerancePct" className="whitespace-nowrap min-w-[200px]">
              Ball-Flight Tolerance (%)
            </Label>
            <Input
              id="practiceBallFlightTolerancePct"
              type="number"
              value={editingPracticeBallFlightTolerancePct}
              onChange={(e) => setEditingPracticeBallFlightTolerancePct(parseFloat(e.target.value) || 0)}
              disabled={!isEditing}
              className="h-8 w-24 text-sm"
            />
            <span className="text-sm text-muted-foreground">
              Status tolerance for launch, height, spin-style, and direction metrics
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Label htmlFor="practiceOtherTolerancePct" className="whitespace-nowrap min-w-[200px]">
              Other Practice Tolerance (%)
            </Label>
            <Input
              id="practiceOtherTolerancePct"
              type="number"
              value={editingPracticeOtherTolerancePct}
              onChange={(e) => setEditingPracticeOtherTolerancePct(parseFloat(e.target.value) || 0)}
              disabled={!isEditing}
              className="h-8 w-24 text-sm"
            />
            <span className="text-sm text-muted-foreground">
              Status tolerance for dispersion, swing, and tempo metrics
            </span>
          </div>
        </CardContent>
      </Card>

      <section id="settings-shot-profiles" className="scroll-mt-6">
        <ShotProfilesCard />
      </section>

      <Card id="settings-playing-partners" className="scroll-mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Playing Partners
          </CardTitle>
          <CardDescription>
            Keep a reusable name directory for the people you play rounds with.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              const name = newPartnerName.trim();
              if (!name) return;
              const exists = partnerDrafts.some((partner) => partner.name.trim().toLowerCase() === name.toLowerCase());
              if (exists) {
                toast.info('That playing partner is already in your directory');
                return;
              }
              const id = crypto.randomUUID();
              setPartnerDrafts((current) => [...current, { id, name, notes: '', hasMobileNumber: false, playedDates: [] }]);
              setExpandedPartnerIds((current) => new Set([...current, id]));
              setHasPartnerChanges(true);
              setNewPartnerName('');
            }}
          >
            <Input
              value={newPartnerName}
              onChange={(event) => setNewPartnerName(event.target.value)}
              placeholder="Add a name"
              className="sm:max-w-sm"
            />
            <Button type="submit" className="gap-2">
              <Plus className="h-4 w-4" />
              Add
            </Button>
            <Button type="button" variant="outline" className="gap-2" onClick={savePlayingPartners} disabled={!hasPartnerChanges}>
              <Save className="h-4 w-4" />
              Save Partners
            </Button>
          </form>
          {partnerDrafts.length > 0 ? (
            <div className="rounded-md border">
              {partnerDrafts
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((partner) => {
                  const expanded = expandedPartnerIds.has(partner.id);
                  const latestDate = latestPlayedDate(partner);
                  const notes = (partner.notes ?? '').trim();
                  return (
                    <div key={partner.id} className="border-b last:border-b-0">
                      <button
                        type="button"
                        className="grid w-full gap-3 px-3 py-4 text-left transition hover:bg-muted/30 md:grid-cols-[minmax(140px,1fr)_110px_180px_minmax(180px,1.4fr)] md:items-center"
                        onClick={() => {
                          setExpandedPartnerIds((current) => {
                            const next = new Set(current);
                            if (next.has(partner.id)) next.delete(partner.id);
                            else next.add(partner.id);
                            return next;
                          });
                        }}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                          <span className="truncate font-semibold">{partner.name || 'Unnamed partner'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className={`h-4 w-4 ${partner.hasMobileNumber ? 'text-green-600' : 'text-muted-foreground/40'}`} />
                          <span className="text-muted-foreground">{partner.hasMobileNumber ? 'Mobile' : 'No mobile'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarDays className="h-4 w-4" />
                          {latestDate ? `${latestDate} · ${partner.playedDates?.length ?? 0} date${(partner.playedDates?.length ?? 0) === 1 ? '' : 's'}` : 'No dates yet'}
                        </div>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {notes || 'No notes yet'}
                        </p>
                      </button>
                      {expanded && (
                        <div className="grid gap-4 border-t bg-muted/10 p-4 lg:grid-cols-[minmax(180px,260px)_minmax(220px,1fr)_minmax(220px,320px)]">
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label htmlFor={`partner-name-${partner.id}`}>Name</Label>
                              <Input
                                id={`partner-name-${partner.id}`}
                                value={partner.name}
                                onChange={(event) => updatePartnerDraft(partner.id, { name: event.target.value })}
                                className="h-9"
                              />
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={partner.hasMobileNumber === true}
                                onCheckedChange={(checked) => updatePartnerDraft(partner.id, { hasMobileNumber: checked === true })}
                              />
                              I have their mobile number
                            </label>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`partner-notes-${partner.id}`}>Comments and Notes</Label>
                            <Textarea
                              id={`partner-notes-${partner.id}`}
                              value={partner.notes ?? ''}
                              onChange={(event) => updatePartnerDraft(partner.id, { notes: event.target.value })}
                              placeholder="Anything useful to remember"
                              className="min-h-[120px]"
                            />
                          </div>
                          <div className="space-y-3">
                            <Label htmlFor={`partner-date-${partner.id}`}>Dates Played Together</Label>
                            <div className="flex gap-2">
                              <Input
                                id={`partner-date-${partner.id}`}
                                type="date"
                                value={partnerDateDrafts[partner.id] ?? ''}
                                onChange={(event) => setPartnerDateDrafts((current) => ({ ...current, [partner.id]: event.target.value }))}
                                className="h-9"
                              />
                              <Button type="button" variant="outline" size="sm" onClick={() => addPlayedDate(partner.id)}>
                                Add
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {(partner.playedDates ?? []).map((date) => (
                                <span key={date} className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs">
                                  {date}
                                  <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => removePlayedDate(partner.id, date)}>
                                    x
                                  </button>
                                </span>
                              ))}
                              {(partner.playedDates ?? []).length === 0 && <span className="text-sm text-muted-foreground">No dates added yet.</span>}
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2 text-destructive hover:text-destructive"
                                onClick={() => {
                                  setPartnerDrafts((current) => current.filter((item) => item.id !== partner.id));
                                  setHasPartnerChanges(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                Remove
                              </Button>
                              <Button type="button" size="sm" className="gap-2" onClick={savePlayingPartners}>
                                <Save className="h-4 w-4" />
                                Save
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="rounded-md border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
              No playing partners saved yet.
            </div>
          )}
        </CardContent>
      </Card>

      <section id="settings-shot-classification" className="scroll-mt-6">
        <ShotClassificationRulesCard />
      </section>

    </div>
  );
}

function ShotClassificationRulesCard() {
  const { shots, gappingHcpTarget } = useGolfData();
  const { practiceConfigs, practiceSessions } = usePracticeData();
  const profiles = useShotProfiles();
  const rules = useShotClassificationRules();
  const [draft, setDraft] = useState<Record<string, string>>(() => rulesToDraft(rules));
  const [fullNormalDraft, setFullNormalDraft] = useState<Record<string, boolean>>(() => rulesToFullNormalDraft(rules));
  const practiceSessionIds = useMemo(() => practiceSessions.map((session) => session.id), [practiceSessions]);
  const { shotsBySession } = usePracticeShotsBySessions(practiceSessionIds);

  const gappingAssignments = useMemo(() => buildCourseShotGappingAssignments({
    profiles,
    shots,
    practiceSessions,
    practiceConfigs,
    shotsBySession,
    gappingHcpTarget,
    shotClassificationRules: rules,
  }), [profiles, shots, practiceSessions, practiceConfigs, shotsBySession, gappingHcpTarget, rules]);

  useEffect(() => {
    setDraft(rulesToDraft(rules));
    setFullNormalDraft(rulesToFullNormalDraft(rules));
  }, [rules]);

  const setRuleDraft = (clubId: string, shotType: string, value: string) => {
    const key = shotClassificationRuleKey(clubId, shotType);
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const setClubFullNormalDraft = (clubId: string, checked: boolean) => {
    setFullNormalDraft(prev => ({ ...prev, [clubId]: checked }));
  };

  const importLatestGappingRules = (clubId: string) => {
    const recentClubShots = shots
      .filter((shot) => getClubConfigId(shot.club) === clubId && Number.isFinite(shot.target))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 80);
    const buckets = new Map<string, { fullTargets: number[]; reducedTargets: number[] }>();

    for (const shot of recentClubShots) {
      const assignment = gappingAssignments.shotToAssignment.get(shot.id);
      if (!assignment) continue;
      const parsed = parsePracticeConfigKey(assignment.configKey);
      if (parsed.club !== clubId || !parsed.shotType || !parsed.power) continue;
      const bucket = buckets.get(parsed.shotType) ?? { fullTargets: [], reducedTargets: [] };
      if (parsed.power === 'full') bucket.fullTargets.push(shot.target);
      else bucket.reducedTargets.push(shot.target);
      buckets.set(parsed.shotType, bucket);
    }

    const imported: Record<string, string> = {};
    for (const [shotType, bucket] of buckets.entries()) {
      if (bucket.fullTargets.length === 0) continue;
      const lowestFull = Math.min(...bucket.fullTargets);
      const highestReduced = bucket.reducedTargets.length ? Math.max(...bucket.reducedTargets) : null;
      const cutoff = highestReduced !== null && highestReduced < lowestFull
        ? Math.round((highestReduced + lowestFull) / 2)
        : Math.round(lowestFull);
      imported[shotClassificationRuleKey(clubId, shotType)] = String(Math.max(0, cutoff));
    }

    if (Object.keys(imported).length === 0) {
      toast.info('No recent gapping shot-type split found for this club');
      return;
    }

    setDraft(prev => ({ ...prev, ...imported }));
    setFullNormalDraft(prev => ({ ...prev, [clubId]: false }));
    toast.success(`Imported ${Object.keys(imported).length} cutoff${Object.keys(imported).length === 1 ? '' : 's'} from recent gapping shots`);
  };

  const handleSave = () => {
    const nextRules: ShotClassificationRules = {};
    for (const club of PRACTICE_CLUBS) {
      if (fullNormalDraft[club.id]) {
        nextRules[clubFullNormalRuleKey(club.id)] = { fullMinTarget: null, allFullNormal: true };
      }
    }
    for (const [key, value] of Object.entries(draft)) {
      const trimmed = value.trim();
      if (!trimmed) continue;
      const fullMinTarget = Number(trimmed);
      if (!Number.isFinite(fullMinTarget) || fullMinTarget < 0) continue;
      nextRules[key] = { fullMinTarget };
    }
    saveShotClassificationRules(nextRules);
    toast.success('Shot classification rules saved');
  };

  const handleReset = () => {
    setDraft(rulesToDraft(rules));
    setFullNormalDraft(rulesToFullNormalDraft(rules));
    toast.info('Shot classification changes reverted');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5" />
            Shot Classification Rules
          </CardTitle>
          <CardDescription>
            Classify on-course shots from distance to target. If a rule is set, Full means target distance is at least the cutoff; below it is Half.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>Cancel</Button>
          <Button size="sm" onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          Example: for 6 Iron / Normal, enter 120 to classify targets of 120m or longer as Full, and targets under 120m as Half.
        </div>
        <Accordion type="multiple" className="rounded-md border">
          {PRACTICE_CLUBS.map(club => (
            <AccordionItem key={club.id} value={club.id} className="px-4 last:border-b-0">
              <AccordionTrigger className="hover:no-underline">
                <span>{club.name}</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="mb-3 flex flex-col gap-3 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id={`classification-full-normal-${club.id}`}
                      checked={fullNormalDraft[club.id] ?? false}
                      onCheckedChange={(checked) => setClubFullNormalDraft(club.id, checked === true)}
                    />
                    <Label htmlFor={`classification-full-normal-${club.id}`} className="text-sm leading-tight">
                      Classify every {club.name} shot as Full / Normal
                    </Label>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => importLatestGappingRules(club.id)}>
                    Import latest from gapping
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {SHOT_TYPES.map(shot => {
                    const key = shotClassificationRuleKey(club.id, shot.id);
                    const allFullNormal = fullNormalDraft[club.id] ?? false;
                    return (
                      <div key={shot.id} className="rounded-md border bg-background p-3">
                        <Label htmlFor={`classification-${key}`} className="text-sm font-medium">
                          {shot.name}
                        </Label>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Full &gt;=</span>
                          <Input
                            id={`classification-${key}`}
                            type="number"
                            min="0"
                            inputMode="decimal"
                            value={draft[key] ?? ''}
                            onChange={(event) => setRuleDraft(club.id, shot.id, event.target.value)}
                            disabled={allFullNormal}
                            className="h-8 w-24 text-sm"
                            placeholder="-"
                          />
                          <span className="text-xs text-muted-foreground">m</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

function rulesToDraft(rules: ShotClassificationRules): Record<string, string> {
  return Object.fromEntries(Object.entries(rules).map(([key, rule]) => [
    key,
    rule.fullMinTarget === null ? '' : String(rule.fullMinTarget),
  ]));
}

function rulesToFullNormalDraft(rules: ShotClassificationRules): Record<string, boolean> {
  return Object.fromEntries(PRACTICE_CLUBS.map((club) => [
    club.id,
    isClubFullNormalClassification(rules, club.id),
  ]));
}

export function ShotProfilesCard() {
  const profiles = useShotProfiles();
  const enabledCountForClub = (clubId: string) => (
    Object.values(profiles).filter(profile => profile.clubId === clubId && profile.enabled).length
  );

  const profilesForClubShot = (clubId: string, shotType: string) => (
    Object.values(profiles)
      .filter(profile => (
        profile.clubId === clubId &&
        profile.shotType === shotType &&
        POWER_OPTIONS.some(power => power.id === profile.power)
      ))
      .sort((a, b) => {
        const powerA = POWER_OPTIONS.findIndex(power => power.id === a.power);
        const powerB = POWER_OPTIONS.findIndex(power => power.id === b.power);
        return powerA - powerB;
      })
  );

  const powerNameFor = (powerId: string) => {
    return POWER_OPTIONS.find(power => power.id === powerId)?.name ?? powerId;
  };

  const setProfileAvailable = (profile: ShotProfile, checked: boolean) => {
    updateShotProfile(profile.id, {
      enabled: checked,
      showInPractice: checked,
      showOnCourse: checked,
    });
  };

  const toggleTarget = (profile: ShotProfile, target: ProfileTarget, checked: boolean) => {
    const next = new Set(profile.targets);
    if (checked) next.add(target); else next.delete(target);
    updateShotProfile(profile.id, { targets: Array.from(next) as ProfileTarget[] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Club & Shot Selector</CardTitle>
        <CardDescription>
          One shared list of club, shot, and power options. Enabled options appear everywhere: Practice, Club Gapping, and On Course recommendations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-3 rounded-md border bg-muted/30 p-3 text-sm md:grid-cols-2">
          <div>
            <span className="font-medium text-foreground">Drives: </span>
            Club and shot selectors across Practice, Club Gapping, and On Course recommendations.
          </div>
          <div>
            <span className="font-medium text-foreground">Enabled means: </span>
            the option appears everywhere. Target intent controls whether it maps to Green, Fairway, or both.
          </div>
        </div>
        <Accordion type="multiple" className="rounded-md border">
          {PRACTICE_CLUBS.map(club => {
            const enabledCount = enabledCountForClub(club.id);
            return (
              <AccordionItem key={club.id} value={club.id} className="px-4 last:border-b-0">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex flex-col items-start gap-1 text-left sm:flex-row sm:items-center sm:gap-3">
                    <span>{club.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {enabledCount} enabled option{enabledCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {SHOT_TYPES.map(shot => {
                      const shotProfiles = profilesForClubShot(club.id, shot.id);
                      if (shotProfiles.length === 0) return null;

                      return (
                        <div key={shot.id} className="rounded-md border bg-background">
                          <div className="border-b bg-muted/40 px-3 py-2 font-medium">
                            {shot.name}
                          </div>
                          <div className="divide-y">
                            {shotProfiles.map(profile => (
                              <div key={profile.id} className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(120px,1fr)_minmax(220px,auto)] md:items-center">
                                <label className="flex items-center gap-3">
                                  <Checkbox
                                    checked={profile.enabled}
                                    onCheckedChange={(value) => setProfileAvailable(profile, !!value)}
                                  />
                                  <span className="font-medium">{powerNameFor(profile.power)}</span>
                                  <span className="text-xs text-muted-foreground">Appears everywhere</span>
                                </label>
                                <div className="flex flex-wrap gap-3 md:justify-end">
                                  <label className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                      checked={profile.targets.includes('green')}
                                      disabled={!profile.enabled}
                                      onCheckedChange={(value) => toggleTarget(profile, 'green', !!value)}
                                    />
                                    Green
                                  </label>
                                  <label className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                      checked={profile.targets.includes('fairway')}
                                      disabled={!profile.enabled}
                                      onCheckedChange={(value) => toggleTarget(profile, 'fairway', !!value)}
                                    />
                                    Fairway
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
