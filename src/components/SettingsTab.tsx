import { useState } from 'react';
import { useGolfData } from '@/context/GolfDataContext';
import { ClubConfig, ClubCategory } from '@/types/golf';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings as SettingsIcon, Save, Pencil, Trash2, Plus } from 'lucide-react';
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
import { useEnabledCombos, updateClubCombos } from '@/lib/practiceEnabledCombos';

const CATEGORIES: ClubCategory[] = ['Tee', 'Long Approach', 'Approach', 'Short / Scoring'];

const DEFAULT_NEW_CLUB: Omit<ClubConfig, 'id'> = {
  clubName: '',
  clubCategory: 'Approach',
  stockDistance: 150,
  acceptableDistanceBand: 10,
  acceptableSideBand: 8,
  distanceToTargetEnabled: true,
};

export function SettingsTab() {
  const { clubs, setClubs, deleteClub, distanceToTargetTolerance, setDistanceToTargetTolerance, lowTargetExclusionThreshold, setLowTargetExclusionThreshold } = useGolfData();
  const [editingClubs, setEditingClubs] = useState<ClubConfig[]>(clubs);
  const [editingTolerance, setEditingTolerance] = useState(distanceToTargetTolerance);
  const [editingLowTargetThreshold, setEditingLowTargetThreshold] = useState(lowTargetExclusionThreshold);
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
    setIsEditing(false);
    toast.info('Changes reverted');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Global Settings Card */}
      <Card>
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
      <Card>
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

      <PracticeCombosCard />



      <Card>
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

function PracticeCombosCard() {
  const combos = useEnabledCombos();

  const toggle = (clubId: string, kind: 'shotTypes' | 'powers', id: string, on: boolean) => {
    const current = combos[clubId];
    const set = new Set(current[kind]);
    if (on) set.add(id); else set.delete(id);
    updateClubCombos(clubId, {
      ...current,
      [kind]: Array.from(set),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Practice Combos</CardTitle>
        <CardDescription>
          Pick which shot types and power levels appear in the Practice dropdowns for each club.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {PRACTICE_CLUBS.map(club => {
            const c = combos[club.id] ?? { shotTypes: [], powers: [] };
            return (
              <div key={club.id} className="rounded-md border p-3">
                <div className="mb-2 font-medium">{club.name}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Shot Types</div>
                    <div className="flex flex-wrap gap-3">
                      {SHOT_TYPES.map(s => (
                        <label key={s.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={c.shotTypes.includes(s.id)}
                            onCheckedChange={(v) => toggle(club.id, 'shotTypes', s.id, !!v)}
                          />
                          {s.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Power</div>
                    <div className="flex flex-wrap gap-3">
                      {POWER_OPTIONS.map(p => (
                        <label key={p.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={c.powers.includes(p.id)}
                            onCheckedChange={(v) => toggle(club.id, 'powers', p.id, !!v)}
                          />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
