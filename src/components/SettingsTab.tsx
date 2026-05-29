import { useState } from 'react';
import { useGolfData } from '@/context/GolfDataContext';
import { ClubConfig, ClubCategory } from '@/types/golf';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, CircleDot, Dumbbell, Goal, Settings as SettingsIcon, Save, Pencil, Trash2, Plus, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Toggle } from '@/components/ui/toggle';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { PRACTICE_CLUBS, SHOT_TYPES, POWER_OPTIONS } from '@/types/practiceClubs';
import { ProfileTarget, ShotProfile, updateShotProfile, useShotProfiles } from '@/lib/shotProfiles';
import { DrillBankTab } from '@/components/DrillBankTab';
import { PuttingDrillBankTab } from '@/components/putting/PuttingDrillBankTab';

const CATEGORIES: ClubCategory[] = ['Tee', 'Long Approach', 'Approach', 'Short / Scoring'];

const DEFAULT_NEW_CLUB: Omit<ClubConfig, 'id'> = {
  clubName: '',
  clubCategory: 'Approach',
  stockDistance: 150,
  acceptableDistanceBand: 10,
  acceptableSideBand: 8,
  distanceToTargetEnabled: true,
};

const SETTINGS_SECTIONS = [
  {
    href: '#settings-global',
    title: 'Global Settings',
    description: 'Calculation rules and gapping targets.',
    icon: SettingsIcon,
  },
  {
    href: '#settings-clubs',
    title: 'Club Configuration',
    description: 'Bag setup and tolerance bands.',
    icon: SlidersHorizontal,
  },
  {
    href: '#settings-shot-profiles',
    title: 'Shot Profiles',
    description: 'Practice and on-course shot options.',
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
  const { clubs, setClubs, deleteClub, distanceToTargetTolerance, setDistanceToTargetTolerance, lowTargetExclusionThreshold, setLowTargetExclusionThreshold, gappingHcpTarget, setGappingHcpTarget } = useGolfData();
  const [editingClubs, setEditingClubs] = useState<ClubConfig[]>(clubs);
  const [editingTolerance, setEditingTolerance] = useState(distanceToTargetTolerance);
  const [editingLowTargetThreshold, setEditingLowTargetThreshold] = useState(lowTargetExclusionThreshold);
  const [editingGappingHcpTarget, setEditingGappingHcpTarget] = useState(gappingHcpTarget);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newClub, setNewClub] = useState<Omit<ClubConfig, 'id'>>(DEFAULT_NEW_CLUB);

  const handleInputChange = (id: string, field: keyof ClubConfig, value: string | number | boolean) => {
    setEditingClubs(prev => prev.map(club => 
      club.id === id ? { ...club, [field]: value } : club
    ));
  };

  const handleSave = () => {
    setClubs(editingClubs);
    setDistanceToTargetTolerance(editingTolerance);
    setLowTargetExclusionThreshold(editingLowTargetThreshold);
    setGappingHcpTarget(editingGappingHcpTarget);
    setIsEditing(false);
    toast.success('Settings saved successfully');
  };

  const handleDeleteClub = (id: string, clubName: string) => {
    deleteClub(id);
    setEditingClubs(prev => prev.filter(club => club.id !== id));
    toast.success(`${clubName} removed from bag`);
  };

  const handleAddClub = () => {
    if (!newClub.clubName.trim()) {
      toast.error('Please enter a club name');
      return;
    }
    
    const id = newClub.clubName.toLowerCase().replace(/\s+/g, '-');
    const clubToAdd: ClubConfig = { ...newClub, id };
    
    setEditingClubs(prev => [...prev, clubToAdd]);
    setClubs(prev => [...prev, clubToAdd]);
    setNewClub(DEFAULT_NEW_CLUB);
    setIsAddDialogOpen(false);
    toast.success(`${newClub.clubName} added to bag`);
  };

  const handleReset = () => {
    setEditingClubs(clubs);
    setEditingTolerance(distanceToTargetTolerance);
    setEditingLowTargetThreshold(lowTargetExclusionThreshold);
    setEditingGappingHcpTarget(gappingHcpTarget);
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
        </CardContent>
      </Card>

      {/* Club Configuration Card */}
      <Card id="settings-clubs" className="scroll-mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Club Configuration
            </CardTitle>
            <CardDescription>
              Configure distance bands, acceptable tolerances, and metric settings for each club
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Club
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Club</DialogTitle>
                <DialogDescription>
                  Add a new club to your bag configuration.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="club-name" className="text-right">Name</Label>
                  <Input
                    id="club-name"
                    value={newClub.clubName}
                    onChange={(e) => setNewClub(prev => ({ ...prev, clubName: e.target.value }))}
                    className="col-span-3"
                    placeholder="e.g., 4 Iron"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="club-category" className="text-right">Category</Label>
                  <Select 
                    value={newClub.clubCategory}
                    onValueChange={(value) => setNewClub(prev => ({ ...prev, clubCategory: value as ClubCategory }))}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="stock-dist" className="text-right">Stock Dist (m)</Label>
                  <Input
                    id="stock-dist"
                    type="number"
                    value={newClub.stockDistance}
                    onChange={(e) => setNewClub(prev => ({ ...prev, stockDistance: parseFloat(e.target.value) || 0 }))}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="dist-band" className="text-right">Dist Band (m)</Label>
                  <Input
                    id="dist-band"
                    type="number"
                    value={newClub.acceptableDistanceBand}
                    onChange={(e) => setNewClub(prev => ({ ...prev, acceptableDistanceBand: parseFloat(e.target.value) || 0 }))}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="side-band" className="text-right">Side Band (m)</Label>
                  <Input
                    id="side-band"
                    type="number"
                    value={newClub.acceptableSideBand}
                    onChange={(e) => setNewClub(prev => ({ ...prev, acceptableSideBand: parseFloat(e.target.value) || 0 }))}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Dist-to-Target</Label>
                  <div className="col-span-3 flex items-center">
                    <Switch
                      checked={newClub.distanceToTargetEnabled}
                      onCheckedChange={(checked) => setNewClub(prev => ({ ...prev, distanceToTargetEnabled: checked }))}
                    />
                    <span className="ml-2 text-sm text-muted-foreground">
                      {newClub.distanceToTargetEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddClub}>Add Club</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="min-w-[100px]">Club</th>
                  <th className="min-w-[140px]">Category</th>
                  <th className="min-w-[100px]">Stock Dist (m)</th>
                  <th className="min-w-[100px]">Dist Band (m)</th>
                  <th className="min-w-[100px]">Side Band (m)</th>
                  <th className="min-w-[130px]">Dist-to-Target</th>
                  <th className="min-w-[80px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {editingClubs.map((club) => (
                  <tr key={club.id}>
                    <td className="font-medium">{club.clubName}</td>
                    <td>
                      <Select 
                        value={club.clubCategory}
                        onValueChange={(value) => handleInputChange(club.id, 'clubCategory', value as ClubCategory)}
                        disabled={!isEditing}
                      >
                        <SelectTrigger className="w-full h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td>
                      <Input
                        type="number"
                        value={club.stockDistance}
                        onChange={(e) => handleInputChange(club.id, 'stockDistance', parseFloat(e.target.value) || 0)}
                        disabled={!isEditing}
                        className="h-8 w-20 text-sm input-editable"
                      />
                    </td>
                    <td>
                      <Input
                        type="number"
                        value={club.acceptableDistanceBand}
                        onChange={(e) => handleInputChange(club.id, 'acceptableDistanceBand', parseFloat(e.target.value) || 0)}
                        disabled={!isEditing}
                        className="h-8 w-20 text-sm input-editable"
                      />
                    </td>
                    <td>
                      <Input
                        type="number"
                        value={club.acceptableSideBand}
                        onChange={(e) => handleInputChange(club.id, 'acceptableSideBand', parseFloat(e.target.value) || 0)}
                        disabled={!isEditing}
                        className="h-8 w-20 text-sm input-editable"
                      />
                    </td>
                    <td className="text-center">
                      <Switch
                        checked={club.distanceToTargetEnabled}
                        onCheckedChange={(checked) => handleInputChange(club.id, 'distanceToTargetEnabled', checked)}
                        disabled={!isEditing}
                      />
                    </td>
                    <td className="text-center">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={!isEditing}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {club.clubName}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove {club.clubName} from your bag configuration. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDeleteClub(club.id, club.clubName)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            <strong className="text-foreground">On-Target:</strong> Lateral finish within Acceptable Side Band
          </div>
          <div>
            <strong className="text-foreground">Right/Left %:</strong> Shots finishing outside Acceptable Side Band in that direction
          </div>
          <div>
            <strong className="text-foreground">Short %:</strong> Total distance {"<"} (Stock Distance − Distance Band), unless "As Intended"
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
  const profileList = Object.values(profiles).sort((a, b) => {
    const clubA = PRACTICE_CLUBS.findIndex(club => club.id === a.clubId);
    const clubB = PRACTICE_CLUBS.findIndex(club => club.id === b.clubId);
    const shotA = SHOT_TYPES.findIndex(shot => shot.id === a.shotType);
    const shotB = SHOT_TYPES.findIndex(shot => shot.id === b.shotType);
    const powerA = POWER_OPTIONS.findIndex(power => power.id === a.power);
    const powerB = POWER_OPTIONS.findIndex(power => power.id === b.power);
    return clubA - clubB || shotA - shotB || powerA - powerB;
  });

  const nameFor = (profile: ShotProfile) => ({
    club: PRACTICE_CLUBS.find(club => club.id === profile.clubId)?.name ?? profile.clubId,
    shot: SHOT_TYPES.find(shot => shot.id === profile.shotType)?.name ?? profile.shotType,
    power: POWER_OPTIONS.find(power => power.id === profile.power)?.name ?? profile.power,
  });

  const toggleTarget = (profile: ShotProfile, target: ProfileTarget, checked: boolean) => {
    const next = new Set(profile.targets);
    if (checked) next.add(target); else next.delete(target);
    updateShotProfile(profile.id, { targets: Array.from(next) as ProfileTarget[] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shot Profiles</CardTitle>
        <CardDescription>
          One shared setup for Practice, On Course recommendations, wedge matrix, and future technique/routine cards.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="min-w-[90px]">Enabled</th>
                <th className="min-w-[100px]">Club</th>
                <th className="min-w-[110px]">Shot</th>
                <th className="min-w-[90px]">Power</th>
                <th className="min-w-[120px]">Targets</th>
                <th className="min-w-[100px]">Practice</th>
                <th className="min-w-[100px]">On Course</th>
                <th className="min-w-[220px]">Technique Cue</th>
                <th className="min-w-[220px]">Routine Cue</th>
              </tr>
            </thead>
            <tbody>
              {profileList.map(profile => {
                const names = nameFor(profile);
                return (
                  <tr key={profile.id}>
                    <td>
                      <Checkbox
                        checked={profile.enabled}
                        onCheckedChange={(value) => updateShotProfile(profile.id, {
                          enabled: !!value,
                          showInPractice: value === true ? profile.showInPractice || !profile.showOnCourse : false,
                          showOnCourse: value === true ? profile.showOnCourse || !profile.showInPractice : false,
                        })}
                      />
                    </td>
                    <td className="font-medium">{names.club}</td>
                    <td>{names.shot}</td>
                    <td>{names.power}</td>
                    <td>
                      <div className="flex flex-wrap gap-3">
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
                    </td>
                    <td>
                      <Checkbox
                        checked={profile.showInPractice}
                        disabled={!profile.enabled}
                        onCheckedChange={(value) => updateShotProfile(profile.id, { showInPractice: !!value })}
                      />
                    </td>
                    <td>
                      <Checkbox
                        checked={profile.showOnCourse}
                        disabled={!profile.enabled}
                        onCheckedChange={(value) => updateShotProfile(profile.id, { showOnCourse: !!value })}
                      />
                    </td>
                    <td>
                      <Input
                        value={profile.technique}
                        disabled={!profile.enabled}
                        onChange={(event) => updateShotProfile(profile.id, { technique: event.target.value })}
                        placeholder="e.g. chest through, hold finish"
                        className="h-8 min-w-[210px] text-sm"
                      />
                    </td>
                    <td>
                      <Input
                        value={profile.routine}
                        disabled={!profile.enabled}
                        onChange={(event) => updateShotProfile(profile.id, { routine: event.target.value })}
                        placeholder="e.g. pick start line, one rehearsal"
                        className="h-8 min-w-[210px] text-sm"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
