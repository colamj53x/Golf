import { useEffect, useMemo, useState } from 'react';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Crosshair, Goal, Lightbulb, Plus, Save, Settings as SettingsIcon, Pencil, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Toggle } from '@/components/ui/toggle';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
import {
  DEFAULT_SHOT_PICKER_ADJUSTMENTS,
  getClubAdjustmentLabel,
  getDirectionAdjustmentLabel,
  parseShotPickerAdjustments,
  type ShotPickerAdjustmentRule,
  type ShotPickerAdjustmentSettings,
  type ShotPickerDirection,
  type ShotPickerDirectionAmount,
  type ShotPickerFeet,
  type ShotPickerLie,
  type ShotPickerSlope,
} from '@/lib/shotPickerAdjustments';
import { DEFAULT_SHOT_CUES, saveShotCues, useShotCues, type ShotCueCard } from '@/lib/shotCues';
import { DURABLE_LOCAL_SETTINGS_HYDRATED_EVENT } from '@/lib/durableLocalSettings';
import {
  createSettingsIdea,
  loadSettingsIdeaTags,
  loadSettingsIdeas,
  mergeSettingsIdeaTags,
  rememberSettingsIdeaTags,
  saveSettingsIdeas,
  type SettingsIdea,
} from '@/lib/settingsIdeas';

const SETTINGS_SECTIONS = [
  {
    href: '#settings-ideas',
    title: 'Ideas',
    description: 'Keep a tagged list of things to try or build.',
    icon: Lightbulb,
  },
  {
    href: '#settings-global',
    title: 'Global Settings',
    description: 'Calculation rules and gapping targets.',
    icon: SettingsIcon,
  },
  {
    href: '#settings-shot-picker-adjustments',
    title: 'Shot Picker Adjustments',
    description: 'Lie, slope, and feet rules for on-course targeting.',
    icon: Crosshair,
  },
  {
    href: '#settings-shot-profiles',
    title: 'Shot Options & Cues',
    description: 'Where shots appear and what cues they use.',
    icon: Goal,
  },
  {
    href: '#settings-shot-classification',
    title: 'Shot Classification Rules',
    description: 'Distance-to-target cutoffs for Full and Half shots.',
    icon: SlidersHorizontal,
  },
  { href: '#settings-shot-cues', title: 'Practice & On-Course Cues', description: 'Edit the notes shown on practice PDFs and Play cue cards.', icon: Goal },
];

const lieAdjustmentRows: Array<{ key: ShotPickerLie; label: string; note: string }> = [
  { key: 'tee', label: 'Tee', note: 'Clean lie. Usually no adjustment.' },
  { key: 'fairway', label: 'Fairway', note: 'Standard approach baseline.' },
  { key: 'roughRecovery', label: 'Rough / Recovery', note: 'Default is one more club.' },
];

const slopeAdjustmentRows: Array<{ key: ShotPickerSlope; label: string; note: string }> = [
  { key: 'flat', label: 'Flat', note: 'No slope adjustment.' },
  { key: 'uphill', label: 'Uphill', note: 'Default is one more club.' },
  { key: 'downhill', label: 'Downhill', note: 'Default is one less club.' },
];

const feetAdjustmentRows: Array<{ key: ShotPickerFeet; label: string; note: string }> = [
  { key: 'level', label: 'Feet level', note: 'No stance adjustment.' },
  { key: 'above', label: 'Ball above feet', note: 'Default target is right for a right-handed player.' },
  { key: 'below', label: 'Ball below feet', note: 'Default target is left for a right-handed player.' },
];

const directionOptions: Array<{ value: ShotPickerDirection; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'left', label: 'Aim left' },
  { value: 'right', label: 'Aim right' },
];

const directionAmountOptions: Array<{ value: ShotPickerDirectionAmount; label: string }> = [
  { value: 'small', label: 'Slight' },
  { value: 'medium', label: 'Moderate' },
  { value: 'large', label: 'Large' },
];

const GAPPING_QUALITY_FALLBACK_OPTIONS = [
  { value: -10, label: 'Pro' },
  { value: -5, label: 'Elite amateur' },
  { value: 0, label: '0 HCP' },
  { value: 5, label: '5 HCP' },
  { value: 10, label: '10 HCP' },
  { value: 15, label: '15 HCP' },
  { value: 20, label: '20 HCP' },
  { value: 25, label: '25 HCP' },
] as const;

export function SettingsTab() {
  const {
    distanceToTargetTolerance,
    setDistanceToTargetTolerance,
    lowTargetExclusionThreshold,
    setLowTargetExclusionThreshold,
    gappingReliablePercent,
    setGappingReliablePercent,
    gappingQualityFallbackHcp,
    setGappingQualityFallbackHcp,
    gappingGreenThreshold,
    setGappingGreenThreshold,
    gappingAmberThreshold,
    setGappingAmberThreshold,
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
  } = useGolfData();
  const [editingTolerance, setEditingTolerance] = useState(distanceToTargetTolerance);
  const [editingLowTargetThreshold, setEditingLowTargetThreshold] = useState(lowTargetExclusionThreshold);
  const [editingGappingReliablePercent, setEditingGappingReliablePercent] = useState(gappingReliablePercent);
  const [editingGappingQualityFallbackHcp, setEditingGappingQualityFallbackHcp] = useState(gappingQualityFallbackHcp);
  const [editingGappingGreenThreshold, setEditingGappingGreenThreshold] = useState(gappingGreenThreshold);
  const [editingGappingAmberThreshold, setEditingGappingAmberThreshold] = useState(gappingAmberThreshold);
  const [editingShotPickerDistanceTolerancePct, setEditingShotPickerDistanceTolerancePct] = useState(shotPickerDistanceTolerancePct);
  const [editingPracticeDistanceTolerancePct, setEditingPracticeDistanceTolerancePct] = useState(practiceDistanceTolerancePct);
  const [editingPracticeBallFlightTolerancePct, setEditingPracticeBallFlightTolerancePct] = useState(practiceBallFlightTolerancePct);
  const [editingPracticeOtherTolerancePct, setEditingPracticeOtherTolerancePct] = useState(practiceOtherTolerancePct);
  const [editingTodayRecentShotCount, setEditingTodayRecentShotCount] = useState(todayRecentShotCount);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    setDistanceToTargetTolerance(editingTolerance);
    setLowTargetExclusionThreshold(editingLowTargetThreshold);
    setGappingReliablePercent(Math.max(10, Math.min(100, Math.round(editingGappingReliablePercent))));
    setGappingQualityFallbackHcp(GAPPING_QUALITY_FALLBACK_OPTIONS.some(option => option.value === editingGappingQualityFallbackHcp)
      ? editingGappingQualityFallbackHcp
      : 10);
    const nextAmber = Math.max(0, Math.min(100, Math.round(editingGappingAmberThreshold)));
    const nextGreen = Math.max(nextAmber, Math.min(100, Math.round(editingGappingGreenThreshold)));
    setGappingAmberThreshold(nextAmber);
    setGappingGreenThreshold(nextGreen);
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
    setEditingGappingReliablePercent(gappingReliablePercent);
    setEditingGappingQualityFallbackHcp(gappingQualityFallbackHcp);
    setEditingGappingGreenThreshold(gappingGreenThreshold);
    setEditingGappingAmberThreshold(gappingAmberThreshold);
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

      <IdeasCard />

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
            <Label htmlFor="gappingReliablePercent" className="whitespace-nowrap min-w-[200px]">
              Gapping Reliability (%)
            </Label>
            <Input
              id="gappingReliablePercent"
              type="number"
              min={10}
              max={100}
              step={5}
              value={editingGappingReliablePercent}
              onChange={(e) => setEditingGappingReliablePercent(Math.max(10, Math.min(100, Math.round(parseFloat(e.target.value) || 60))))}
              disabled={!isEditing}
              className="h-8 w-24 text-sm"
            />
            <span className="text-sm text-muted-foreground">
              Sets how many rated shots must be covered when choosing each club's predictable distance
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Label htmlFor="gappingQualityFallbackHcp" className="whitespace-nowrap min-w-[200px]">
              Gapping Quality Fallback
            </Label>
            <Select
              value={String(editingGappingQualityFallbackHcp)}
              onValueChange={(value) => setEditingGappingQualityFallbackHcp(Number(value))}
              disabled={!isEditing}
            >
              <SelectTrigger id="gappingQualityFallbackHcp" className="h-8 w-40 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GAPPING_QUALITY_FALLBACK_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              HCP cutoff used only when quality ratings cannot calculate one. Shared by Club Gapping and Shot Picker.
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Label htmlFor="gappingGreenThreshold" className="whitespace-nowrap min-w-[200px]">
              Gapping Green (%)
            </Label>
            <Input
              id="gappingGreenThreshold"
              type="number"
              min={0}
              max={100}
              step={5}
              value={editingGappingGreenThreshold}
              onChange={(e) => setEditingGappingGreenThreshold(Math.max(0, Math.min(100, Math.round(parseFloat(e.target.value) || 65))))}
              disabled={!isEditing}
              className="h-8 w-24 text-sm"
            />
            <span className="text-sm text-muted-foreground">
              Green dot threshold for Last 20 T, Last 20 Safe, and Range %
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Label htmlFor="gappingAmberThreshold" className="whitespace-nowrap min-w-[200px]">
              Gapping Amber (%)
            </Label>
            <Input
              id="gappingAmberThreshold"
              type="number"
              min={0}
              max={100}
              step={5}
              value={editingGappingAmberThreshold}
              onChange={(e) => setEditingGappingAmberThreshold(Math.max(0, Math.min(100, Math.round(parseFloat(e.target.value) || 40))))}
              disabled={!isEditing}
              className="h-8 w-24 text-sm"
            />
            <span className="text-sm text-muted-foreground">
              Amber dot threshold; lower values show red
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

      <section id="settings-shot-picker-adjustments" className="scroll-mt-6">
        <ShotPickerAdjustmentsCard />
      </section>

      <section id="settings-shot-profiles" className="scroll-mt-6">
        <ShotProfilesCard />
      </section>

      <section id="settings-shot-classification" className="scroll-mt-6">
        <ShotClassificationRulesCard />
      </section>

      <section id="settings-shot-cues" className="scroll-mt-6">
        <ShotCueSettingsCard />
      </section>

    </div>
  );
}

function IdeasCard() {
  const [ideas, setIdeas] = useState<SettingsIdea[]>(() => loadSettingsIdeas());
  const [savedTags, setSavedTags] = useState<string[]>(() => loadSettingsIdeaTags());
  const [ideaText, setIdeaText] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);

  const allTags = useMemo(() => mergeSettingsIdeaTags(
    savedTags,
    ideas.flatMap(idea => idea.tags),
  ).sort((left, right) => left.localeCompare(right)), [ideas, savedTags]);
  const filteredIdeas = useMemo(() => selectedTag
    ? ideas.filter(idea => idea.tags.some(tag => tag.toLocaleLowerCase() === selectedTag.toLocaleLowerCase()))
    : ideas, [ideas, selectedTag]);
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const idea of ideas) {
      for (const tag of idea.tags) {
        const key = tag.toLocaleLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return counts;
  }, [ideas]);
  const tagInputParts = tagsInput.split(',');
  const currentTagQuery = (tagInputParts[tagInputParts.length - 1] || '').trim().toLocaleLowerCase();
  const completedTagKeys = new Set(tagInputParts.slice(0, -1).map(tag => tag.trim().toLocaleLowerCase()).filter(Boolean));
  const tagSuggestions = allTags.filter(tag => (
    !completedTagKeys.has(tag.toLocaleLowerCase()) &&
    tag.toLocaleLowerCase().includes(currentTagQuery)
  ));

  useEffect(() => {
    const handleHydrated = () => {
      const nextIdeas = loadSettingsIdeas();
      const nextTags = mergeSettingsIdeaTags(loadSettingsIdeaTags(), nextIdeas.flatMap(idea => idea.tags));
      setIdeas(nextIdeas);
      setSavedTags(nextTags);
    };
    handleHydrated();
    window.addEventListener(DURABLE_LOCAL_SETTINGS_HYDRATED_EVENT, handleHydrated);
    return () => window.removeEventListener(DURABLE_LOCAL_SETTINGS_HYDRATED_EVENT, handleHydrated);
  }, []);

  const updateIdeas = (nextIdeas: SettingsIdea[]) => {
    setIdeas(nextIdeas);
    saveSettingsIdeas(nextIdeas);
  };

  const handleAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ideaText.trim()) {
      toast.error('Add some text for your idea');
      return;
    }

    const nextIdea = createSettingsIdea(ideaText, tagsInput);
    updateIdeas([nextIdea, ...ideas]);
    setSavedTags(rememberSettingsIdeaTags(nextIdea.tags));
    setIdeaText('');
    setTagsInput('');
    toast.success('Idea added');
  };

  const handleDone = (idea: SettingsIdea) => {
    setSavedTags(rememberSettingsIdeaTags(allTags));
    updateIdeas(ideas.filter(candidate => candidate.id !== idea.id));
    toast.success('Idea completed and removed');
  };

  const selectTagSuggestion = (tag: string) => {
    const completedTags = tagInputParts.slice(0, -1).map(value => value.trim()).filter(Boolean);
    setTagsInput(`${[...completedTags, tag].join(', ')}, `);
    setIsTagMenuOpen(false);
  };

  return (
    <Card id="settings-ideas" className="scroll-mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Ideas
        </CardTitle>
        <CardDescription>
          Capture things you want to try. Tags are remembered for reuse, and marking an idea done removes only the idea.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {allTags.length > 0 && (
          <div className="space-y-2">
            <Label>Filter by tag</Label>
            <div className="flex flex-wrap gap-2" aria-label="Filter ideas by tag">
              <Button
                type="button"
                size="sm"
                variant={selectedTag === null ? 'default' : 'outline'}
                className="h-7 rounded-full px-3"
                onClick={() => setSelectedTag(null)}
              >
                All <span className="ml-1 opacity-70">{ideas.length}</span>
              </Button>
              {allTags.map(tag => {
                const isSelected = selectedTag?.toLocaleLowerCase() === tag.toLocaleLowerCase();
                return (
                  <Button
                    key={tag.toLocaleLowerCase()}
                    type="button"
                    size="sm"
                    variant={isSelected ? 'default' : 'outline'}
                    className="h-7 rounded-full px-3"
                    onClick={() => setSelectedTag(isSelected ? null : tag)}
                  >
                    {tag} <span className="ml-1 opacity-70">{tagCounts.get(tag.toLocaleLowerCase()) || 0}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        <form onSubmit={handleAdd} className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(180px,1fr)_auto] md:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="settings-idea-text">Idea</Label>
            <Input
              id="settings-idea-text"
              value={ideaText}
              onChange={event => setIdeaText(event.target.value)}
              placeholder="Something to try or build..."
              autoComplete="off"
            />
          </div>
          <div className="relative space-y-1.5">
            <Label htmlFor="settings-idea-tags">Tags</Label>
            <Input
              id="settings-idea-tags"
              value={tagsInput}
              onChange={event => setTagsInput(event.target.value)}
              onFocus={() => setIsTagMenuOpen(true)}
              onBlur={() => setIsTagMenuOpen(false)}
              placeholder="practice, reports"
              aria-describedby="settings-idea-tags-help"
              autoComplete="off"
            />
            {isTagMenuOpen && allTags.length > 0 && (
              <div role="listbox" aria-label="Saved idea tags" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                {tagSuggestions.length > 0 ? tagSuggestions.map(tag => (
                  <button
                    key={tag.toLocaleLowerCase()}
                    type="button"
                    role="option"
                    aria-selected="false"
                    className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => selectTagSuggestion(tag)}
                  >
                    <span>{tag}</span>
                    <span className="text-xs text-muted-foreground">
                      {tagCounts.get(tag.toLocaleLowerCase()) || 0} {(tagCounts.get(tag.toLocaleLowerCase()) || 0) === 1 ? 'idea' : 'ideas'}
                    </span>
                  </button>
                )) : (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">No saved tags match. Keep typing to add a new one.</div>
                )}
              </div>
            )}
            <p id="settings-idea-tags-help" className="text-xs text-muted-foreground">Separate tags with commas.</p>
          </div>
          <Button type="submit" className="gap-2 md:mb-5">
            <Plus className="h-4 w-4" />
            Add idea
          </Button>
        </form>

        {ideas.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No ideas yet. Add one above when inspiration strikes.
          </div>
        ) : filteredIdeas.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No current ideas use the <span className="font-medium text-foreground">{selectedTag}</span> tag.
            <Button type="button" variant="link" className="ml-1 h-auto p-0" onClick={() => setSelectedTag(null)}>Show all ideas</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredIdeas.map(idea => (
              <div key={idea.id} className="flex flex-col gap-3 rounded-md border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words font-medium">{idea.text}</p>
                  {idea.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {idea.tags.map(tag => <Badge key={tag.toLocaleLowerCase()} variant="secondary">{tag}</Badge>)}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2 self-start sm:self-auto"
                  onClick={() => handleDone(idea)}
                  aria-label={`Mark ${idea.text} done and remove it`}
                >
                  <Check className="h-4 w-4" />
                  Done
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ShotCueSettingsCard() {
  const cards = useShotCues();
  const [draft, setDraft] = useState<ShotCueCard[]>(cards);
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setDraft(cards); }, [cards, editing]);
  const update = (id: string, field: keyof ShotCueCard, value: string) => setDraft(current => current.map(card => card.id === id ? { ...card, [field]: value } : card));
  const updateTechnique = (id: string, index: number, field: 'text' | 'fullText' | 'halfText', value: string) => setDraft(current => current.map(card => card.id === id ? {
    ...card,
    technique: card.technique.map((note, noteIndex) => noteIndex === index ? { ...note, [field]: value } : note),
  } : card));
  const courseFields: Array<[keyof ShotCueCard, string]> = [['goal', 'Shot description'], ['setup', 'Set-up'], ['look', 'Look / strike focus'], ['swing', 'Swing feel'], ['finish', 'Finish'], ['fullClock', 'Full-shot swing size'], ['halfClock', 'Half-shot swing size'], ['courseCue', 'One cue']];

  return <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Practice Technique & On-Course Cues</CardTitle><CardDescription>Edit the simplified shot-card rows used in practice plans, PDFs, and on-course cue cards.</CardDescription></div><div className="flex gap-2">{editing && <Button variant="outline" onClick={() => { setDraft(cards); setEditing(false); }}>Cancel</Button>}<Button onClick={() => { if (editing) { saveShotCues(draft); toast.success('Shot cues saved'); } setEditing(!editing); }}>{editing ? <><Save className="mr-2 h-4 w-4" />Save</> : <><Pencil className="mr-2 h-4 w-4" />Edit</>}</Button></div></div></CardHeader><CardContent><Accordion type="single" collapsible className="w-full">{draft.map(card => <AccordionItem key={card.id} value={card.id}><AccordionTrigger><span><span className="font-semibold">{card.title}</span><span className="ml-2 text-xs font-normal text-muted-foreground">{card.appliesTo}</span></span></AccordionTrigger><AccordionContent className="space-y-6 pt-2">
    <div className="space-y-4"><h4 className="font-semibold">Practice plan / PDF rows</h4>{card.technique.map((note, index) => <div key={`${note.label}-${index}`} className="rounded-md border p-3"><Label>{note.label}</Label>{note.fullText !== undefined || note.halfText !== undefined ? <div className="mt-2 grid gap-3 sm:grid-cols-2"><div><div className="mb-1 text-xs text-muted-foreground">Full</div><Textarea value={note.fullText || ''} disabled={!editing} onChange={event => updateTechnique(card.id, index, 'fullText', event.target.value)} rows={3} /></div><div><div className="mb-1 text-xs text-muted-foreground">Half</div><Textarea value={note.halfText || ''} disabled={!editing} onChange={event => updateTechnique(card.id, index, 'halfText', event.target.value)} rows={3} /></div></div> : <Textarea className="mt-2" value={note.text} disabled={!editing} onChange={event => updateTechnique(card.id, index, 'text', event.target.value)} rows={3} />}</div>)}</div>
    <div className="space-y-4 border-t pt-5"><h4 className="font-semibold">On-course card</h4>{courseFields.filter(([field]) => (field !== 'fullClock' && field !== 'halfClock') || card[field] !== undefined).map(([field, label]) => <div key={field} className="space-y-1.5"><Label>{label}</Label><Textarea value={(card[field] as string) || ''} disabled={!editing} onChange={event => update(card.id, field, event.target.value)} rows={field === 'courseCue' ? 2 : 3} /></div>)}</div>
  </AccordionContent></AccordionItem>)}</Accordion>{editing && <Button variant="ghost" className="mt-4" onClick={() => setDraft(DEFAULT_SHOT_CUES)}>Restore defaults</Button>}</CardContent></Card>;
}

function ShotPickerAdjustmentsCard() {
  const { shotPickerAdjustments, setShotPickerAdjustments } = useGolfData();
  const [draft, setDraft] = useState<ShotPickerAdjustmentSettings>(() => parseShotPickerAdjustments(shotPickerAdjustments));

  useEffect(() => {
    setDraft(parseShotPickerAdjustments(shotPickerAdjustments));
  }, [shotPickerAdjustments]);

  const setRule = (
    group: keyof ShotPickerAdjustmentSettings,
    key: string,
    updates: Partial<ShotPickerAdjustmentRule>,
  ) => {
    setDraft(prev => ({
      ...prev,
      [group]: {
        ...prev[group],
        [key]: {
          ...prev[group][key as never],
          ...updates,
        },
      },
    }));
  };

  const handleSave = () => {
    setShotPickerAdjustments(parseShotPickerAdjustments(draft));
    toast.success('Shot Picker adjustments saved');
  };

  const handleReset = () => {
    setDraft(DEFAULT_SHOT_PICKER_ADJUSTMENTS);
    setShotPickerAdjustments(DEFAULT_SHOT_PICKER_ADJUSTMENTS);
    toast.info('Shot Picker adjustments reset');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5" />
            Shot Picker Adjustments
          </CardTitle>
          <CardDescription>
            Tune the default club and target adjustments used by the Play Shot Picker.
          </CardDescription>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>Reset</Button>
          <Button size="sm" onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <AdjustmentGroup
          title="Lie"
          rows={lieAdjustmentRows}
          rules={draft.lie}
          onChange={(key, updates) => setRule('lie', key, updates)}
        />
        <AdjustmentGroup
          title="Slope"
          rows={slopeAdjustmentRows}
          rules={draft.slope}
          onChange={(key, updates) => setRule('slope', key, updates)}
        />
        <AdjustmentGroup
          title="Feet"
          rows={feetAdjustmentRows}
          rules={draft.feet}
          onChange={(key, updates) => setRule('feet', key, updates)}
        />
      </CardContent>
    </Card>
  );
}

function AdjustmentGroup<K extends string>({
  title,
  rows,
  rules,
  onChange,
}: {
  title: string;
  rows: Array<{ key: K; label: string; note: string }>;
  rules: Record<K, ShotPickerAdjustmentRule>;
  onChange: (key: K, updates: Partial<ShotPickerAdjustmentRule>) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid gap-3">
        {rows.map((row) => {
          const rule = rules[row.key];
          return (
            <div key={row.key} className="grid gap-3 rounded-md border bg-background p-3 lg:grid-cols-[minmax(160px,1fr)_120px_150px_140px] lg:items-center">
              <div>
                <div className="font-medium">{row.label}</div>
                <div className="text-xs text-muted-foreground">{row.note}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {getClubAdjustmentLabel(rule.clubDelta)} · {getDirectionAdjustmentLabel(rule)}
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`adjustment-club-${title}-${row.key}`} className="text-xs">Club</Label>
                <Input
                  id={`adjustment-club-${title}-${row.key}`}
                  type="number"
                  min={-3}
                  max={3}
                  step={1}
                  value={rule.clubDelta}
                  onChange={(event) => onChange(row.key, { clubDelta: Math.max(-3, Math.min(3, Math.round(Number(event.target.value) || 0))) })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Direction</Label>
                <Select value={rule.direction} onValueChange={(value) => onChange(row.key, { direction: value as ShotPickerDirection })}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {directionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bias size</Label>
                <Select
                  value={rule.directionAmount}
                  onValueChange={(value) => onChange(row.key, { directionAmount: value as ShotPickerDirectionAmount })}
                  disabled={rule.direction === 'none'}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {directionAmountOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShotClassificationRulesCard() {
  const { shots, gappingReliablePercent } = useGolfData();
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
    gappingReliablePercent,
    shotClassificationRules: rules,
  }), [profiles, shots, practiceSessions, practiceConfigs, shotsBySession, gappingReliablePercent, rules]);

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
