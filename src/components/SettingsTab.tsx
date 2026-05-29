import { useState } from 'react';
import { useGolfData } from '@/context/GolfDataContext';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, CircleDot, Dumbbell, Goal, Settings as SettingsIcon, Save, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Toggle } from '@/components/ui/toggle';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PRACTICE_CLUBS, SHOT_TYPES, POWER_OPTIONS } from '@/types/practiceClubs';
import { ProfileTarget, ShotProfile, updateShotProfile, useShotProfiles } from '@/lib/shotProfiles';
import { DrillBankTab } from '@/components/DrillBankTab';
import { PuttingDrillBankTab } from '@/components/putting/PuttingDrillBankTab';

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
    href: '#settings-full-swing-drills',
    title: 'Full Swing Drill Bank',
    description: 'Technique, baseline, and scored drills.',
    icon: Dumbbell,
  },
  {
    href: '#settings-putting-drills',
    title: 'Putting Drill Bank',
    description: 'Indoor putting sets and scored drills.',
    icon: CircleDot,
  },
  {
    href: '#settings-definitions',
    title: 'Definitions',
    description: 'Metric reference notes.',
    icon: BookOpen,
  },
];

export function SettingsTab() {
  const {
    distanceToTargetTolerance,
    setDistanceToTargetTolerance,
    lowTargetExclusionThreshold,
    setLowTargetExclusionThreshold,
    gappingHcpTarget,
    setGappingHcpTarget,
    practiceDistanceTolerancePct,
    setPracticeDistanceTolerancePct,
    practiceBallFlightTolerancePct,
    setPracticeBallFlightTolerancePct,
    practiceOtherTolerancePct,
    setPracticeOtherTolerancePct,
  } = useGolfData();
  const [editingTolerance, setEditingTolerance] = useState(distanceToTargetTolerance);
  const [editingLowTargetThreshold, setEditingLowTargetThreshold] = useState(lowTargetExclusionThreshold);
  const [editingGappingHcpTarget, setEditingGappingHcpTarget] = useState(gappingHcpTarget);
  const [editingPracticeDistanceTolerancePct, setEditingPracticeDistanceTolerancePct] = useState(practiceDistanceTolerancePct);
  const [editingPracticeBallFlightTolerancePct, setEditingPracticeBallFlightTolerancePct] = useState(practiceBallFlightTolerancePct);
  const [editingPracticeOtherTolerancePct, setEditingPracticeOtherTolerancePct] = useState(practiceOtherTolerancePct);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    setDistanceToTargetTolerance(editingTolerance);
    setLowTargetExclusionThreshold(editingLowTargetThreshold);
    setGappingHcpTarget(editingGappingHcpTarget);
    setPracticeDistanceTolerancePct(editingPracticeDistanceTolerancePct);
    setPracticeBallFlightTolerancePct(editingPracticeBallFlightTolerancePct);
    setPracticeOtherTolerancePct(editingPracticeOtherTolerancePct);
    setIsEditing(false);
    toast.success('Settings saved successfully');
  };

  const handleReset = () => {
    setEditingTolerance(distanceToTargetTolerance);
    setEditingLowTargetThreshold(lowTargetExclusionThreshold);
    setEditingGappingHcpTarget(gappingHcpTarget);
    setEditingPracticeDistanceTolerancePct(practiceDistanceTolerancePct);
    setEditingPracticeBallFlightTolerancePct(practiceBallFlightTolerancePct);
    setEditingPracticeOtherTolerancePct(practiceOtherTolerancePct);
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

      <section id="settings-full-swing-drills" className="scroll-mt-6">
        <DrillBankTab />
      </section>

      <section id="settings-putting-drills" className="scroll-mt-6">
        <PuttingDrillBankTab />
      </section>

      <Card id="settings-definitions" className="scroll-mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Definitions Reference</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <strong className="text-foreground">On-Target:</strong> Lateral finish inside the accepted miss width for that club/shot
          </div>
          <div>
            <strong className="text-foreground">Right/Left %:</strong> Shots finishing outside the accepted miss width in that direction
          </div>
          <div>
            <strong className="text-foreground">Short %:</strong> Shots finishing meaningfully short of the expected distance, unless "As Intended"
          </div>
          <div>
            <strong className="text-foreground">Bad Miss %:</strong> Penalty or Recovery required (punch-out, chip-out)
          </div>
          <div>
            <strong className="text-foreground">Distance-to-Target:</strong> Only calculated for shots "targeting the green" (target within tolerance of stock distance)
          </div>
          <div>
            <strong className="text-foreground">Greens Targeted %:</strong> Percentage of shots where target is within tolerance of stock distance
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ShotProfilesCard() {
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
