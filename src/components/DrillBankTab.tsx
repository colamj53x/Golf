import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Pencil, RotateCcw } from 'lucide-react';
import {
  getAllDrills,
  type DrillKind,
  type DrillLevel,
  type DrillWithMeta,
} from '@/lib/practiceDrillsLibrary';
import {
  loadAssignments,
  setDrillAssignments,
  assignmentToken,
  type AssignmentMap,
} from '@/lib/drillAssignments';
import {
  loadCustomDrills,
  addCustomDrill,
  deleteCustomDrill,
  updateCustomDrill,
  customDrillToMeta,
  type CustomDrillInput,
} from '@/lib/customDrills';
import {
  loadOverrides,
  setOverride,
  clearOverride,
  applyOverride,
  drillToInput,
} from '@/lib/drillOverrides';
import { loadHiddenDrills, hideDrill, unhideDrill } from '@/lib/drillHidden';
import { PRACTICE_CLUBS, SHOT_TYPES } from '@/types/practiceClubs';

const KIND_LABEL: Record<DrillKind, string> = {
  technique: 'Technique',
  scorable: 'Scorable',
  baseline: 'Baseline',
};

const KIND_VARIANT: Record<DrillKind, 'default' | 'secondary' | 'outline'> = {
  technique: 'default',
  scorable: 'secondary',
  baseline: 'outline',
};

function descriptionText(d: DrillWithMeta): string {
  const drill = d.drill;
  if (drill.kind === 'technique') return drill.description ?? drill.focus;
  if (drill.kind === 'baseline') return drill.description ?? drill.what;
  return drill.description;
}

function metricsOf(d: DrillWithMeta): string[] {
  return d.drill.metricsAddressed ?? [];
}

const EMPTY_FORM: CustomDrillInput = {
  name: '',
  kind: 'technique',
  level: 'beginner',
  description: '',
  metricsAddressed: [],
  fixes: [],
  balls: 20,
  maxScore: 20,
  scoring: '',
  pass: 12,
  setup: '',
  cue: '',
  reps: '10 balls — warm-up only, not scored.',
};

export function DrillBankTab() {
  const [customVersion, setCustomVersion] = useState(0);
  const [showHidden, setShowHidden] = useState(false);
  const hiddenIds = loadHiddenDrills();
  const drills = useMemo(() => {
    const overrides = loadOverrides();
    const builtIns = getAllDrills().map((m) => applyOverride(m, overrides[m.drill.id]));
    const customs = loadCustomDrills().map(customDrillToMeta);
    return [...builtIns, ...customs];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customVersion]);

  const [assignments, setAssignments] = useState<AssignmentMap>(() => loadAssignments());
  const [kindFilter, setKindFilter] = useState<'all' | DrillKind>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | DrillLevel>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<DrillWithMeta | null>(null);
  const [draftTokens, setDraftTokens] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [editingDrillId, setEditingDrillId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomDrillInput>(EMPTY_FORM);
  const [metricsInput, setMetricsInput] = useState('');

  const filtered = drills.filter((d) => {
    const hidden = hiddenIds.includes(d.drill.id);
    if (hidden && !showHidden) return false;
    if (kindFilter !== 'all' && d.drill.kind !== kindFilter) return false;
    if (levelFilter !== 'all' && d.level !== levelFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const hay = `${d.drill.name} ${descriptionText(d)} ${metricsOf(d).join(' ')} ${(d.drill.fixes ?? []).join(' ')}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  function openAssign(d: DrillWithMeta) {
    setEditing(d);
    setDraftTokens(assignments[d.drill.id] ?? []);
  }

  function toggleToken(token: string) {
    setDraftTokens((prev) =>
      prev.includes(token) ? prev.filter((t) => t !== token) : [...prev, token],
    );
  }

  function saveAssign() {
    if (!editing) return;
    const next = setDrillAssignments(editing.drill.id, draftTokens);
    setAssignments(next);
    setEditing(null);
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setMetricsInput('');
    setFormMode('add');
    setEditingDrillId(null);
    setFormOpen(true);
  }

  function openEdit(d: DrillWithMeta) {
    const input = drillToInput(d);
    setForm({ ...EMPTY_FORM, ...input });
    setMetricsInput((input.metricsAddressed ?? []).join(', '));
    setFormMode('edit');
    setEditingDrillId(d.drill.id);
    setFormOpen(true);
  }

  function saveDrillForm() {
    if (!form.name.trim() || !form.description.trim()) return;
    const metrics = metricsInput
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    const payload = { ...form, metricsAddressed: metrics };
    if (formMode === 'add') {
      addCustomDrill(payload);
    } else if (editingDrillId) {
      if (isCustom(editingDrillId)) {
        updateCustomDrill(editingDrillId, payload);
      } else {
        setOverride(editingDrillId, payload);
      }
    }
    setFormOpen(false);
    setCustomVersion((v) => v + 1);
  }

  function removeCustom(id: string) {
    deleteCustomDrill(id);
    setCustomVersion((v) => v + 1);
  }

  function resetBuiltIn(id: string) {
    clearOverride(id);
    setCustomVersion((v) => v + 1);
  }

  function removeBuiltIn(id: string) {
    hideDrill(id);
    setCustomVersion((v) => v + 1);
  }

  function restoreBuiltIn(id: string) {
    unhideDrill(id);
    setCustomVersion((v) => v + 1);
  }

  const isCustom = (id: string) => id.startsWith('custom_');
  const hasOverride = (id: string) => {
    if (isCustom(id)) return false;
    return Boolean(loadOverrides()[id]);
  };


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Drill & Technique Bank</CardTitle>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" /> Add Drill
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          All drills in one place. Techniques are a 10-ball warm-up reminder — not scored.
          Scorable drills and baseline checks are tracked over time. Assign drills as active
          against the clubs and shot types you want to practice them with.
        </p>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Search</label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, description, metric, fix…"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Type</label>
            <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as typeof kindFilter)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="technique">Technique</SelectItem>
                <SelectItem value="scorable">Scorable</SelectItem>
                <SelectItem value="baseline">Baseline</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Level</label>
            <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as typeof levelFilter)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <Checkbox
              id="show-hidden"
              checked={showHidden}
              onCheckedChange={(v) => setShowHidden(v === true)}
            />
            <label htmlFor="show-hidden" className="text-xs text-muted-foreground cursor-pointer">
              Show hidden ({hiddenIds.length})
            </label>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Drill</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Description & Metrics</TableHead>
                <TableHead>Active on</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No drills match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((d) => {
                  const tokens = assignments[d.drill.id] ?? [];
                  const metrics = metricsOf(d);
                  return (
                    <TableRow key={d.drill.id}>
                      <TableCell className="font-medium align-top">
                        {d.drill.name}
                        {d.drill.kind === 'technique' && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            Warm-up · not scored
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant={KIND_VARIANT[d.drill.kind]}>{KIND_LABEL[d.drill.kind]}</Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant={d.level === 'advanced' ? 'destructive' : 'outline'}>
                          {d.level === 'advanced' ? 'Advanced' : 'Beginner'}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top max-w-md">
                        <div className="text-sm">{descriptionText(d)}</div>
                        {metrics.length > 0 && (
                          <div className="mt-2">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                              Moves
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {metrics.map((m) => (
                                <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {d.drill.fixes && d.drill.fixes.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {d.drill.fixes.map((f) => (
                              <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        {tokens.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {tokens.map((t) => {
                              const [c, s] = t.split('_');
                              const clubName = PRACTICE_CLUBS.find((x) => x.id === c)?.name ?? c;
                              const shotName = SHOT_TYPES.find((x) => x.id === s)?.name ?? s;
                              return (
                                <Badge key={t} variant="secondary" className="text-[10px]">
                                  {clubName} · {shotName}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => openAssign(d)}>
                            {tokens.length === 0 ? 'Assign' : 'Assigned'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(d)}
                            title="Edit drill"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {hasOverride(d.drill.id) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => resetBuiltIn(d.drill.id)}
                              title="Reset to default"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          {isCustom(d.drill.id) ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeCustom(d.drill.id)}
                              title="Delete custom drill"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : hiddenIds.includes(d.drill.id) ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => restoreBuiltIn(d.drill.id)}
                              title="Restore drill"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeBuiltIn(d.drill.id)}
                              title="Delete drill"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>

                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Assign dialog */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.drill.name}</DialogTitle>
            <DialogDescription>
              Tick every club + shot type combination this drill should be active for.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Club</TableHead>
                  {SHOT_TYPES.map((s) => (
                    <TableHead key={s.id} className="text-center">{s.name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {PRACTICE_CLUBS.map((club) => (
                  <TableRow key={club.id}>
                    <TableCell className="font-medium">{club.name}</TableCell>
                    {SHOT_TYPES.map((s) => {
                      const token = assignmentToken(club.id, s.id);
                      const checked = draftTokens.includes(token);
                      return (
                        <TableCell key={s.id} className="text-center">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleToken(token)}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveAssign}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit drill dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formMode === 'add' ? 'Add a drill' : 'Edit drill'}</DialogTitle>
            <DialogDescription>
              Describe the drill and which metrics it should move. Techniques are warm-up only and
              not scored.
            </DialogDescription>
          </DialogHeader>


          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Tee-height ladder"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) => setForm({ ...form, kind: v as DrillKind })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technique">Technique (10-ball warm-up, not scored)</SelectItem>
                    <SelectItem value="scorable">Scorable (20 balls, tracked)</SelectItem>
                    <SelectItem value="baseline">Baseline (6 balls, 0/1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Level</Label>
                <Select
                  value={form.level}
                  onValueChange={(v) => setForm({ ...form, level: v as DrillLevel })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What the drill is, how it's run, and what it should fix."
                rows={5}
              />
            </div>

            <div>
              <Label>Metrics addressed (comma-separated)</Label>
              <Input
                value={metricsInput}
                onChange={(e) => setMetricsInput(e.target.value)}
                placeholder="Smash Factor, Carry distance, Start line"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Use the same metric names you read in your reports.
              </p>
            </div>

            {form.kind === 'technique' && (
              <>
                <div>
                  <Label>Setup</Label>
                  <Input
                    value={form.setup ?? ''}
                    onChange={(e) => setForm({ ...form, setup: e.target.value })}
                    placeholder="How to set up the drill"
                  />
                </div>
                <div>
                  <Label>Cue / feel</Label>
                  <Input
                    value={form.cue ?? ''}
                    onChange={(e) => setForm({ ...form, cue: e.target.value })}
                    placeholder="One-line cue"
                  />
                </div>
              </>
            )}

            {form.kind === 'scorable' && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Balls</Label>
                    <Input
                      type="number"
                      value={form.balls ?? 20}
                      onChange={(e) => setForm({ ...form, balls: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Max score</Label>
                    <Input
                      type="number"
                      value={form.maxScore ?? 20}
                      onChange={(e) => setForm({ ...form, maxScore: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Pass</Label>
                    <Input
                      type="number"
                      value={form.pass ?? 12}
                      onChange={(e) => setForm({ ...form, pass: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Scoring rule</Label>
                  <Textarea
                    value={form.scoring ?? ''}
                    onChange={(e) => setForm({ ...form, scoring: e.target.value })}
                    placeholder="How each ball is scored"
                    rows={2}
                  />
                </div>
              </>
            )}

            {form.kind === 'baseline' && (
              <>
                <div>
                  <Label>Setup</Label>
                  <Input
                    value={form.setup ?? ''}
                    onChange={(e) => setForm({ ...form, setup: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Scoring rule (out of 6)</Label>
                  <Input
                    value={form.scoring ?? ''}
                    onChange={(e) => setForm({ ...form, scoring: e.target.value })}
                    placeholder="1 if … 0 otherwise. Out of 6."
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={saveDrillForm} disabled={!form.name.trim() || !form.description.trim()}>
              {formMode === 'add' ? 'Save drill' : 'Save changes'}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </Card>
  );
}
