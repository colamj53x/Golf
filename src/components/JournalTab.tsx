import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarDays, Check, ClipboardList, Copy, ExternalLink, FileText, History, Lightbulb, PenLine, Plus, Save, Search, Sparkles, Trash2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useGolfData } from '@/context/GolfDataContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { buildCourseHistoryReflection, buildLastFiveReflection, buildPreRoundReflection, createEmptyJournalEntryDraft, hasJournalEntryContent, JOURNAL_CATEGORIES, normalizeJournalEntryDraft, ROUND_TYPES } from '@/lib/golfJournal';
import { deleteJournalEntry, loadGeneratedJournalReflections, loadJournalEntries, saveGeneratedJournalReflection, upsertJournalEntry } from '@/lib/golfJournalRepository';
import { getShotDateKey } from '@/lib/golfCalculations';
import { buildRoundReview, isPuttingShot } from '@/lib/roundReview';
import type { GeneratedJournalReflection, JournalCategoryKey, JournalEntry, JournalEntryDraft, PlayingPartner } from '@/types/golf';

type JournalView = 'home' | 'entry' | 'history' | 'last5' | 'course' | 'preRound';

const ACTIONS: Array<{ view: JournalView; title: string; description: string; icon: typeof PenLine }> = [
  { view: 'entry', title: 'Write Round Journal', description: 'Capture what you noticed, felt, learned, and want to try next.', icon: PenLine },
  { view: 'last5', title: 'Create Last 5 Rounds Reflection', description: 'Generate a generous written summary from recent entries.', icon: Sparkles },
  { view: 'course', title: 'Review Course History', description: 'See what previous rounds at a course are trying to tell you.', icon: History },
  { view: 'preRound', title: 'Before Next Round', description: 'Create a short caddie-note reminder before you play.', icon: ClipboardList },
];

function ratingOptions() {
  return [1, 2, 3, 4, 5].map((rating) => <SelectItem key={rating} value={String(rating)}>{rating}</SelectItem>);
}

function ratingValue(value: number | null) {
  return value === null ? 'none' : String(value);
}

function textFromCategory(entry: JournalEntry, key: JournalCategoryKey): string {
  const category = entry.categories[key];
  return [category.whatHappened, category.likelyCause, category.tryNextTime, category.generalNotes].filter(Boolean).join(' ');
}

function partnerNames(partners: PlayingPartner[], ids: string[]): string[] {
  return ids.map((id) => partners.find((partner) => partner.id === id)?.name).filter((name): name is string => Boolean(name));
}

function formatMetric(value: number | null, percent = false): string {
  if (value === null) return '-';
  return `${Math.round(value)}${percent ? '%' : ''}`;
}

function MetricContextCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border bg-muted/15 p-3">
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function PartnerTags({ partners, selectedIds, onChange }: { partners: PlayingPartner[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [selected, setSelected] = useState('');
  const available = partners.filter((partner) => !selectedIds.includes(partner.id));
  return (
    <div className="space-y-2">
      <Select
        value={selected}
        onValueChange={(value) => {
          setSelected('');
          if (value) onChange([...selectedIds, value]);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Add playing partner" />
        </SelectTrigger>
        <SelectContent>
          {available.length === 0 ? <SelectItem value="none" disabled>No partners available</SelectItem> : available.map((partner) => (
            <SelectItem key={partner.id} value={partner.id}>{partner.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex flex-wrap gap-2">
        {partnerNames(partners, selectedIds).map((name, index) => {
          const id = selectedIds[index];
          return (
            <Badge key={id} variant="outline" className="gap-1">
              {name}
              <button type="button" className="ml-1 text-muted-foreground hover:text-destructive" onClick={() => onChange(selectedIds.filter((item) => item !== id))}>x</button>
            </Badge>
          );
        })}
      </div>
    </div>
  );
}

function ReflectionTextCard({ title, text, onCopy }: { title: string; text: string; onCopy: () => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Generated from journal text only. AI hook can replace this later.</CardDescription>
        </div>
        <Button variant="outline" className="w-fit gap-2" onClick={onCopy} disabled={!text.trim()}>
          <Copy className="h-4 w-4" />
          Copy
        </Button>
      </CardHeader>
      <CardContent>
        <pre className="max-h-[560px] whitespace-pre-wrap rounded-md border bg-muted/15 p-4 text-sm leading-6">{text || 'Nothing generated yet.'}</pre>
      </CardContent>
    </Card>
  );
}

export function JournalTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { shots, clubs, distanceToTargetTolerance, playingPartners } = useGolfData();
  const [view, setView] = useState<JournalView>('home');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [generated, setGenerated] = useState<GeneratedJournalReflection[]>([]);
  const [draft, setDraft] = useState<JournalEntryDraft>(() => createEmptyJournalEntryDraft());
  const [editingId, setEditingId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [courseQuery, setCourseQuery] = useState('');
  const [preRoundCourse, setPreRoundCourse] = useState('');
  const [lastGeneratedText, setLastGeneratedText] = useState('');
  const [courseGeneratedText, setCourseGeneratedText] = useState('');
  const [preRoundGeneratedText, setPreRoundGeneratedText] = useState('');

  const uploadedRounds = useMemo(() => [...new Set(shots.filter((shot) => !isPuttingShot(shot)).map((shot) => getShotDateKey(shot.date)))]
    .sort((a, b) => b.localeCompare(a)), [shots]);

  const courseNames = useMemo(() => [...new Set(entries.map((entry) => entry.courseName.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b)), [entries]);

  const latestEntries = entries.slice(0, 5);
  const latestGenerated = generated[0] ?? null;
  const recentCourses = courseNames.slice(0, 6);

  const selectedRoundReview = useMemo(() => {
    if (!draft.roundReviewId) return null;
    return buildRoundReview(shots, clubs, distanceToTargetTolerance, draft.roundReviewId);
  }, [clubs, distanceToTargetTolerance, draft.roundReviewId, shots]);

  const filteredHistory = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => [
      entry.date,
      entry.courseName,
      entry.roundType,
      entry.overallComments,
      entry.generalContext,
      ...partnerNames(playingPartners, entry.playingPartnerIds),
    ].some((value) => value.toLowerCase().includes(query)));
  }, [entries, historyQuery, playingPartners]);

  const loadJournal = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [nextEntries, nextGenerated] = await Promise.all([
        loadJournalEntries(user.id),
        loadGeneratedJournalReflections(user.id),
      ]);
      setEntries(nextEntries);
      setGenerated(nextGenerated);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to load journal:', error);
      toast.error('Journal could not be loaded');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadJournal();
  }, [loadJournal]);

  const updateDraft = (updates: Partial<JournalEntryDraft>) => {
    setDraft((current) => normalizeJournalEntryDraft({ ...current, ...updates }));
  };

  const updateCategory = (key: JournalCategoryKey, updates: Partial<JournalEntryDraft['categories'][JournalCategoryKey]>) => {
    setDraft((current) => normalizeJournalEntryDraft({
      ...current,
      categories: {
        ...current.categories,
        [key]: { ...current.categories[key], ...updates },
      },
    }));
  };

  const startNewEntry = () => {
    setEditingId(undefined);
    setDraft(createEmptyJournalEntryDraft());
    setView('entry');
  };

  const editEntry = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setDraft(normalizeJournalEntryDraft(entry));
    setView('entry');
  };

  const selectUploadedRound = (roundDate: string) => {
    if (roundDate === 'standalone') {
      updateDraft({ roundReviewId: null });
      return;
    }
    const existing = entries.find((entry) => entry.roundReviewId === roundDate);
    if (existing && !editingId) {
      editEntry(existing);
      return;
    }
    updateDraft({ roundReviewId: roundDate, date: roundDate });
  };

  const saveEntry = async () => {
    if (!user) {
      toast.error('Sign in before saving journal entries');
      return;
    }
    if (!draft.date || !hasJournalEntryContent(draft)) {
      toast.error('Add a date and at least one journal note');
      return;
    }
    setIsSaving(true);
    try {
      const saved = await upsertJournalEntry(user.id, draft, editingId);
      await loadJournal();
      setEditingId(saved.id);
      toast.success('Journal entry saved');
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to save journal entry:', error);
      toast.error('Journal entry could not be saved');
    } finally {
      setIsSaving(false);
    }
  };

  const removeEntry = async (entry: JournalEntry) => {
    if (!user) return;
    try {
      await deleteJournalEntry(user.id, entry.id);
      await loadJournal();
      if (editingId === entry.id) startNewEntry();
      toast.success('Journal entry deleted');
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to delete journal entry:', error);
      toast.error('Journal entry could not be deleted');
    }
  };

  const saveGenerated = async (type: GeneratedJournalReflection['type'], text: string, source: JournalEntry[], courseName?: string) => {
    if (!user || !text.trim()) return;
    try {
      await saveGeneratedJournalReflection(user.id, {
        type,
        generatedText: text,
        sourceJournalEntryIds: source.map((entry) => entry.id),
        courseName,
      });
      await loadJournal();
      toast.success('Reflection saved');
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to save generated reflection:', error);
      toast.error('Reflection could not be saved');
    }
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success('Copied');
  };

  const generateLastFive = () => {
    const text = buildLastFiveReflection(latestEntries);
    setLastGeneratedText(text);
    void saveGenerated('last5', text, latestEntries);
  };

  const generateCourseHistory = () => {
    const course = courseQuery.trim();
    const courseEntries = entries.filter((entry) => entry.courseName.trim().toLowerCase() === course.toLowerCase());
    const text = buildCourseHistoryReflection(course || 'Selected course', courseEntries);
    setCourseGeneratedText(text);
    void saveGenerated('course', text, courseEntries, course || null);
  };

  const generatePreRound = () => {
    const course = preRoundCourse.trim();
    const courseEntries = entries.filter((entry) => entry.courseName.trim().toLowerCase() === course.toLowerCase());
    const text = buildPreRoundReflection(course, courseEntries, entries);
    setPreRoundGeneratedText(text);
    void saveGenerated('preRound', text, courseEntries.length ? courseEntries : entries.slice(0, 5), course || null);
  };

  return (
    <div className="space-y-6 text-left">
      <section className="rounded-lg border bg-card p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase text-primary">
              <BookOpen className="h-4 w-4" />
              Golf Journal
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">Notice, reflect, prepare</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Capture the human layer of each round, then turn repeated notes into useful reminders.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate('/partners')}>
              <Users className="h-4 w-4" />
              Partner Tags
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => void loadJournal()} disabled={isLoading}>
              <Check className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </section>
      <datalist id="journal-course-options">{courseNames.map((course) => <option key={course} value={course} />)}</datalist>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ACTIONS.map(({ view: actionView, title, description, icon: Icon }) => (
          <button
            key={actionView}
            type="button"
            className={`rounded-lg border bg-card p-4 text-left shadow-sm transition hover:border-primary/50 hover:bg-muted/20 ${view === actionView ? 'border-primary' : ''}`}
            onClick={() => {
              if (actionView === 'entry' && view !== 'entry') startNewEntry();
              else setView(actionView);
            }}
          >
            <Icon className="h-5 w-5 text-primary" />
            <div className="mt-3 font-semibold">{title}</div>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
          </button>
        ))}
      </div>

      {view === 'home' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Recent journal entries</CardTitle>
                <CardDescription>The latest written reflections across tracked and standalone rounds.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="w-fit gap-2" onClick={() => setView('history')}>
                  <History className="h-4 w-4" />
                  History
                </Button>
                <Button className="w-fit gap-2" onClick={startNewEntry}>
                  <Plus className="h-4 w-4" />
                  New Entry
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <EntryList entries={latestEntries} partners={playingPartners} onEdit={editEntry} onDelete={removeEntry} />
            </CardContent>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Latest reflection summary</CardTitle>
                <CardDescription>{latestGenerated ? latestGenerated.createdAt.toLocaleDateString() : 'No generated reflection yet.'}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="line-clamp-6 text-sm leading-6 text-muted-foreground">{latestGenerated?.generatedText || 'Create a Last 5 reflection when a few journal entries are saved.'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Courses recently played</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {recentCourses.length ? recentCourses.map((course) => <Badge key={course} variant="outline">{course}</Badge>) : <p className="text-sm text-muted-foreground">Add course names to build course memory.</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {view === 'entry' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{editingId ? 'Edit Round Journal' : 'Write Round Journal'}</CardTitle>
                <CardDescription>Free text is the main input. The prompts are just there to help you think.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Linked uploaded round</Label>
                    <Select value={draft.roundReviewId ?? 'standalone'} onValueChange={selectUploadedRound}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standalone">Standalone journal entry</SelectItem>
                        {uploadedRounds.map((roundDate) => <SelectItem key={roundDate} value={roundDate}>{roundDate}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="journal-date">Date</Label>
                    <Input id="journal-date" type="date" value={draft.date} onChange={(event) => updateDraft({ date: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="journal-course">Course</Label>
                    <Input id="journal-course" list="journal-course-options" value={draft.courseName} onChange={(event) => updateDraft({ courseName: event.target.value })} placeholder="Search or type course" />
                  </div>
                  <div className="space-y-2">
                    <Label>Round type</Label>
                    <Select value={draft.roundType} onValueChange={(roundType) => updateDraft({ roundType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ROUND_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Playing partners</Label>
                      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={() => navigate('/partners')}>
                        <ExternalLink className="h-3.5 w-3.5" />
                        Manage
                      </Button>
                    </div>
                    <PartnerTags partners={playingPartners} selectedIds={draft.playingPartnerIds} onChange={(playingPartnerIds) => updateDraft({ playingPartnerIds })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="journal-weather">Weather / conditions</Label>
                    <Input id="journal-weather" value={draft.weatherConditions} onChange={(event) => updateDraft({ weatherConditions: event.target.value })} placeholder="Wind, rain, firm greens, slow greens" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="journal-context">General round context</Label>
                    <Input id="journal-context" value={draft.generalContext} onChange={(event) => updateDraft({ generalContext: event.target.value })} placeholder="What sort of round was this?" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Overall Reflection</CardTitle>
                <CardDescription>The front page of the round: what you noticed, felt, and want to remember.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="overall-comments">Overall comments</Label>
                  <Textarea id="overall-comments" value={draft.overallComments} onChange={(event) => updateDraft({ overallComments: event.target.value })} className="min-h-[180px]" placeholder="What did I notice, feel, learn, and want to work on from this round?" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Overall feel rating</Label>
                    <Select value={ratingValue(draft.overallFeelRating)} onValueChange={(value) => updateDraft({ overallFeelRating: value === 'none' ? null : Number(value) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="none">No rating</SelectItem>{ratingOptions()}</SelectContent>
                    </Select>
                  </div>
                  <PromptInput label="Best thing today" value={draft.bestThingToday} onChange={(bestThingToday) => updateDraft({ bestThingToday })} />
                  <PromptInput label="Biggest frustration" value={draft.biggestFrustration} onChange={(biggestFrustration) => updateDraft({ biggestFrustration })} />
                  <PromptInput label="Main learning" value={draft.mainLearning} onChange={(mainLearning) => updateDraft({ mainLearning })} />
                  <div className="md:col-span-2">
                    <PromptInput label="Focus for next round" value={draft.focusForNextRound} onChange={(focusForNextRound) => updateDraft({ focusForNextRound })} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Category Reflections</CardTitle>
                <CardDescription>Guided notebook prompts for the main parts of the game.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {JOURNAL_CATEGORIES.map(({ key, label }) => {
                  const category = draft.categories[key];
                  return (
                    <div key={key} className="rounded-lg border p-4">
                      <div className="grid gap-4 lg:grid-cols-[190px_minmax(0,1fr)]">
                        <div className="space-y-2">
                          <h3 className="font-semibold">{label}</h3>
                          <Select value={ratingValue(category.feelRating)} onValueChange={(value) => updateCategory(key, { feelRating: value === 'none' ? null : Number(value) })}>
                            <SelectTrigger><SelectValue placeholder="Feel rating" /></SelectTrigger>
                            <SelectContent><SelectItem value="none">No rating</SelectItem>{ratingOptions()}</SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          <PromptInput label="What happened?" value={category.whatHappened} onChange={(whatHappened) => updateCategory(key, { whatHappened })} />
                          <PromptInput label="Likely cause" value={category.likelyCause} onChange={(likelyCause) => updateCategory(key, { likelyCause })} />
                          <PromptInput label="What to try next time" value={category.tryNextTime} onChange={(tryNextTime) => updateCategory(key, { tryNextTime })} />
                          <div className="space-y-2 md:col-span-3">
                            <Label>{label} notes</Label>
                            <Textarea value={category.generalNotes} onChange={(event) => updateCategory(key, { generalNotes: event.target.value })} className="min-h-[110px]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button className="gap-2" onClick={() => void saveEntry()} disabled={isSaving}>
                    <Save className="h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save Journal Entry'}
                  </Button>
                  <Button variant="outline" onClick={startNewEntry}>Start New</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Round review context</CardTitle>
                <CardDescription>Visible for context only; the journal stays written and reflective.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedRoundReview ? (
                  <>
                    <MetricContextCard label="Shot Quality" value={formatMetric(selectedRoundReview.round.shotQualityIndex)} detail={`Season avg ${formatMetric(selectedRoundReview.season.shotQualityIndex)}`} />
                    <MetricContextCard label="Target Success" value={formatMetric(selectedRoundReview.round.targetSuccessPct, true)} detail={`Last 5 ${formatMetric(selectedRoundReview.last5.targetSuccessPct, true)}`} />
                    <MetricContextCard label="Safe Shot Rate" value={formatMetric(selectedRoundReview.round.safeShotRate, true)} detail={`Previous 5 ${formatMetric(selectedRoundReview.previous5.safeShotRate, true)}`} />
                    <MetricContextCard label="Scoring Zone" value={formatMetric(selectedRoundReview.round.scoringZoneSuccessPct, true)} detail={`Season avg ${formatMetric(selectedRoundReview.season.scoringZoneSuccessPct, true)}`} />
                    <Button variant="outline" className="w-full gap-2" onClick={() => navigate(`/review/rounds?round=${encodeURIComponent(draft.roundReviewId ?? '')}`)}>
                      <ExternalLink className="h-4 w-4" />
                      Open Round Review
                    </Button>
                  </>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">Select an uploaded round to show review cards beside the journal entry.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {view === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle>Journal History</CardTitle>
            <CardDescription>Browse by course, date, round type, partner, or any written note.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Search journal history" />
            </div>
            <EntryList entries={filteredHistory} partners={playingPartners} onEdit={editEntry} onDelete={removeEntry} />
          </CardContent>
        </Card>
      )}

      {view === 'last5' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Create Last 5 Rounds Reflection</CardTitle>
                <CardDescription>Long-form reflection from the latest five journal entries, not scores.</CardDescription>
              </div>
              <Button className="w-fit gap-2" onClick={generateLastFive} disabled={latestEntries.length === 0}>
                <Sparkles className="h-4 w-4" />
                Generate
              </Button>
            </CardHeader>
          </Card>
          <ReflectionTextCard title="Last 5 Rounds Reflection" text={lastGeneratedText} onCopy={() => void copyText(lastGeneratedText)} />
        </div>
      )}

      {view === 'course' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Course History</CardTitle>
              <CardDescription>Search a course and generate repeated themes from entries at that course.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-2">
                <Label htmlFor="course-history-search">Course</Label>
                <Input id="course-history-search" list="journal-course-options" value={courseQuery} onChange={(event) => setCourseQuery(event.target.value)} placeholder="Select or type course" />
              </div>
              <Button className="mt-auto gap-2" onClick={generateCourseHistory}>
                <Lightbulb className="h-4 w-4" />
                Generate Course Notes
              </Button>
            </CardContent>
          </Card>
          <EntryList entries={entries.filter((entry) => entry.courseName.trim().toLowerCase() === courseQuery.trim().toLowerCase())} partners={playingPartners} onEdit={editEntry} onDelete={removeEntry} />
          <ReflectionTextCard title="Course-specific themes" text={courseGeneratedText} onCopy={() => void copyText(courseGeneratedText)} />
        </div>
      )}

      {view === 'preRound' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Before Next Round</CardTitle>
              <CardDescription>Brief reminder using course-specific history when available, otherwise recent journal themes.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-2">
                <Label htmlFor="pre-round-course">Course</Label>
                <Input id="pre-round-course" list="journal-course-options" value={preRoundCourse} onChange={(event) => setPreRoundCourse(event.target.value)} placeholder="Course you are about to play" />
              </div>
              <Button className="mt-auto gap-2" onClick={generatePreRound}>
                <FileText className="h-4 w-4" />
                Create Caddie Note
              </Button>
            </CardContent>
          </Card>
          <ReflectionTextCard title="Before Next Round" text={preRoundGeneratedText} onCopy={() => void copyText(preRoundGeneratedText)} />
        </div>
      )}
    </div>
  );
}

function PromptInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function EntryList({ entries, partners, onEdit, onDelete }: {
  entries: JournalEntry[];
  partners: PlayingPartner[];
  onEdit: (entry: JournalEntry) => void;
  onDelete: (entry: JournalEntry) => void;
}) {
  if (entries.length === 0) {
    return <div className="rounded-md border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">No journal entries found.</div>;
  }

  return (
    <div className="divide-y rounded-md border">
      {entries.map((entry) => {
        const partnersForEntry = partnerNames(partners, entry.playingPartnerIds);
        const categoryPreview = JOURNAL_CATEGORIES.map(({ key, label }) => {
          const text = textFromCategory(entry, key);
          return text ? `${label}: ${text}` : '';
        }).filter(Boolean).slice(0, 2).join(' ');
        return (
          <div key={entry.id} className="grid gap-3 p-4 lg:grid-cols-[180px_minmax(0,1fr)_auto] lg:items-center">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                {entry.date}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{entry.roundReviewId ? 'Linked round' : 'Standalone'}</Badge>
                {entry.roundType && <Badge variant="secondary">{entry.roundType}</Badge>}
              </div>
            </div>
            <div className="min-w-0">
              <div className="font-medium">{entry.courseName || 'No course saved'}</div>
              {partnersForEntry.length > 0 && <p className="text-xs text-muted-foreground">Played with {partnersForEntry.join(', ')}</p>}
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                {entry.overallComments || entry.generalContext || categoryPreview || 'No written preview.'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onEdit(entry)}>Edit</Button>
              <Button variant="outline" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDelete(entry)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
