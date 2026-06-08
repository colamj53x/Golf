import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarDays, CheckCircle, Copy, ExternalLink, FileText, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useGolfData } from '@/context/GolfDataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  createEmptyRoundReflectionDraft,
  hasRoundReflectionContent,
  RoundReflectionDraft,
  RoundReflectionEditor,
} from '@/components/RoundReflectionEditor';
import { getShotDateKey } from '@/lib/golfCalculations';
import {
  clearRoundReflectionLocalSaved,
  saveRoundReflectionLocalSaved,
} from '@/lib/roundReflectionDrafts';

const NOTE_FIELDS = [
  ['generalComments', 'Comments'],
  ['drivingNotes', 'Driving'],
  ['ironsNotes', 'Irons and Hybrids'],
  ['shortNotes', 'Short Game'],
  ['puttingNotes', 'Putting'],
  ['mentalNotes', 'Mental'],
  ['courseManagementNotes', 'Course Management'],
] as const;

const SUMMARY_CATEGORIES = NOTE_FIELDS.filter(([key]) => key !== 'generalComments');

type NoteFieldKey = typeof NOTE_FIELDS[number][0];

function noteText(reflection: { [key: string]: string | string[] }): string {
  return NOTE_FIELDS
    .map(([key]) => reflection[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .trim();
}

function valuesForField(
  reflections: Array<{ roundDate: string } & Record<NoteFieldKey, string>>,
  field: NoteFieldKey,
): string[] {
  return reflections
    .map((reflection) => {
      const value = reflection[field].trim();
      return value ? `${reflection.roundDate}: ${value}` : '';
    })
    .filter(Boolean);
}

function categorySummary(values: string[]): string {
  if (values.length === 0) return 'No clear pattern logged yet.';
  if (values.length === 1) return values[0];
  return values.slice(0, 3).join(' ');
}

function buildOverallTheme(reflections: Array<{ roundDate: string } & Record<NoteFieldKey, string>>): string {
  if (reflections.length === 0) return 'No round reflections saved yet.';

  const general = valuesForField(reflections, 'generalComments');
  const mental = valuesForField(reflections, 'mentalNotes');
  const source = [...general, ...mental];
  if (source.length > 0) return source.slice(0, 2).join(' ');

  return `${reflections.length} recent round reflection${reflections.length === 1 ? '' : 's'} saved. The category notes below are the current story.`;
}

function buildNextFocus(reflections: Array<{ roundDate: string } & Record<NoteFieldKey, string>>): string[] {
  const scored = SUMMARY_CATEGORIES
    .map(([key, label]) => ({
      label,
      count: reflections.filter((reflection) => reflection[key].trim().length > 0).length,
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((entry) => `Review ${entry.label.toLowerCase()} decisions and write one commitment before the next round.`);

  return scored.length > 0 ? scored : ['Add at least one reflection after the next round so patterns can start to emerge.'];
}

export function JournalTab() {
  const { user } = useAuth();
  const { shots, roundReflections, playingPartners, setPlayingPartners, refreshRoundReflections, upsertRoundReflection } = useGolfData();
  const navigate = useNavigate();
  const [roundNoteDate, setRoundNoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [roundNoteDraft, setRoundNoteDraft] = useState<RoundReflectionDraft>(createEmptyRoundReflectionDraft());
  const [roundNoteStatus, setRoundNoteStatus] = useState<string | null>(null);
  const [isSavingRoundNote, setIsSavingRoundNote] = useState(false);
  const [summaryReflection, setSummaryReflection] = useState('');

  const shotDates = useMemo(() => new Set(shots.map((shot) => getShotDateKey(shot.date))), [shots]);
  const notesWithContent = useMemo(() => roundReflections
    .filter((reflection) => noteText(reflection).length > 0 || reflection.playingPartnerIds.length > 0)
    .sort((a, b) => b.roundDate.localeCompare(a.roundDate)), [roundReflections]);
  const lastFiveNotes = notesWithContent.slice(0, 5);
  const overallTheme = buildOverallTheme(lastFiveNotes);
  const nextFocus = buildNextFocus(lastFiveNotes);

  useEffect(() => {
    void refreshRoundReflections();
  }, [refreshRoundReflections, user]);

  const partnerNames = (ids: string[]) => ids
    .map((id) => playingPartners.find((partner) => partner.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  useEffect(() => {
    const existing = roundReflections.find((reflection) => reflection.roundDate === roundNoteDate);
    setRoundNoteDraft(existing ? {
      generalComments: existing.generalComments,
      drivingNotes: existing.drivingNotes,
      ironsNotes: existing.ironsNotes,
      shortNotes: existing.shortNotes,
      puttingNotes: existing.puttingNotes,
      mentalNotes: existing.mentalNotes,
      courseManagementNotes: existing.courseManagementNotes,
      playingPartnerIds: existing.playingPartnerIds,
    } : createEmptyRoundReflectionDraft());
    setRoundNoteStatus(null);
  }, [roundNoteDate, roundReflections]);

  const addPlayingPartner = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = playingPartners.find((partner) => partner.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    setPlayingPartners((current) => [...current, { id, name: trimmed, notes: '', hasMobileNumber: false, playedDates: [] }]);
    return id;
  };

  const saveRoundNote = async () => {
    if (!user) {
      setRoundNoteStatus('Sign in before saving a round note.');
      return;
    }
    if (!roundNoteDate || !hasRoundReflectionContent(roundNoteDraft)) {
      setRoundNoteStatus('Add a date and at least one note before saving.');
      return;
    }

    setIsSavingRoundNote(true);
    try {
      saveRoundReflectionLocalSaved(user.id, roundNoteDate, roundNoteDraft);
      await upsertRoundReflection(roundNoteDate, roundNoteDraft);
      clearRoundReflectionLocalSaved(user.id, roundNoteDate);
      await refreshRoundReflections();
      setRoundNoteStatus(`Saved round note for ${roundNoteDate}.`);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Round note saved locally but remote sync failed:', error);
      await refreshRoundReflections();
      setRoundNoteStatus(`Saved round note locally for ${roundNoteDate}. It will still appear in Journal.`);
    } finally {
      setIsSavingRoundNote(false);
    }
  };

  const summaryText = lastFiveNotes.map((reflection, index) => {
    const sections = NOTE_FIELDS
      .map(([key, label]) => {
        const value = reflection[key].trim();
        return value ? `${label}: ${value}` : '';
      })
      .filter(Boolean)
      .join('\n');
    const partners = partnerNames(reflection.playingPartnerIds);
    return [
      `Round ${index + 1}: ${reflection.roundDate}${shotDates.has(reflection.roundDate) ? ' (tracked round)' : ' (notes-only round)'}`,
      partners.length ? `Played with: ${partners.join(', ')}` : '',
      sections,
    ].filter(Boolean).join('\n');
  }).join('\n\n---\n\n');

  const structuredSummaryText = [
    `Overall Theme: ${overallTheme}`,
    ...SUMMARY_CATEGORIES.map(([key, label]) => `${label}: ${categorySummary(valuesForField(lastFiveNotes, key))}`),
    `Next Round Focus:\n${nextFocus.map((focus) => `- ${focus}`).join('\n')}`,
  ].join('\n\n');

  const copySummary = async () => {
    await navigator.clipboard.writeText(structuredSummaryText || 'No round notes saved yet.');
    toast.success('Last 5 summary copied');
  };

  const copyRawNotes = async () => {
    await navigator.clipboard.writeText(summaryText || 'No round notes saved yet.');
    toast.success('Raw round notes copied');
  };

  const copySummaryReflection = async () => {
    await navigator.clipboard.writeText(summaryReflection.trim());
    toast.success('Reflection copied');
  };

  const openRound = (roundDate: string) => {
    navigate(`/review/rounds?round=${encodeURIComponent(roundDate)}`);
  };

  const editInJournal = (roundDate: string) => {
    setRoundNoteDate(roundDate);
    requestAnimationFrame(() => document.getElementById('journal-round-reflection-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <div className="space-y-6 text-left">
      <section className="rounded-lg border bg-card p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase text-primary">
              <BookOpen className="h-4 w-4" />
              Golf Journal
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">Round notes, patterns, and reflections</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Review-page notes and notes-only rounds are collected here in date order.
            </p>
          </div>
          <Button variant="outline" className="w-fit gap-2" onClick={() => void refreshRoundReflections()}>
            <CheckCircle className="h-4 w-4" />
            Refresh Notes
          </Button>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Last 5 Round Reflection Summary</CardTitle>
          <CardDescription>Structured from the latest five saved round reflections.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-md border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Overall Theme</p>
            <p className="mt-2 text-sm leading-6">{overallTheme}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {SUMMARY_CATEGORIES.map(([key, label]) => (
              <div key={key} className="rounded-md border p-4">
                <p className="text-sm font-semibold">{label}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{categorySummary(valuesForField(lastFiveNotes, key))}</p>
              </div>
            ))}
          </div>
          <div className="rounded-md border p-4">
            <p className="text-sm font-semibold">Next Round Focus</p>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
              {nextFocus.map((focus) => <li key={focus}>{focus}</li>)}
            </ul>
          </div>
          <Button className="gap-2" onClick={() => void copySummary()} disabled={lastFiveNotes.length === 0}>
            <Copy className="h-4 w-4" />
            Copy Summary
          </Button>
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>My Reflection on the Last 5</CardTitle>
              <CardDescription>Write your interpretation after reading the summary.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={summaryReflection}
                onChange={(event) => setSummaryReflection(event.target.value)}
                placeholder="What does this summary tell me about my game? What is improving? What is costing me shots? What pattern keeps repeating? What am I committing to next round? What should I practise this week?"
                className="min-h-[180px]"
              />
              <Button variant="outline" className="gap-2" onClick={() => void copySummaryReflection()} disabled={!summaryReflection.trim()}>
                <Copy className="h-4 w-4" />
                Copy Reflection
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add Round Reflection</CardTitle>
              <CardDescription>For any round, tracked or untracked. Capture what happened, what you noticed, and what you want to remember.</CardDescription>
            </CardHeader>
            <CardContent id="journal-round-reflection-form" className="space-y-4 scroll-mt-6">
              <div className="max-w-xs space-y-2">
                <Label htmlFor="journal-round-note-date">Round Date</Label>
                <Input id="journal-round-note-date" type="date" value={roundNoteDate} onChange={(event) => setRoundNoteDate(event.target.value)} />
              </div>
              <RoundReflectionEditor
                title={`Round Note · ${roundNoteDate || 'Select a date'}`}
                description="Capture who you played with and what you want to remember from the round."
                value={roundNoteDraft}
                onChange={(next) => {
                  setRoundNoteDraft(next);
                  setRoundNoteStatus(null);
                }}
                playingPartners={playingPartners}
                onAddPlayingPartner={addPlayingPartner}
              />
              {roundNoteStatus && <p className="text-sm text-muted-foreground">{roundNoteStatus}</p>}
              <div className="flex justify-start">
                <Button className="gap-2" onClick={() => void saveRoundNote()} disabled={isSavingRoundNote}>
                  <Save className="h-4 w-4" />
                  {isSavingRoundNote ? 'Saving...' : 'Save Round Note'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Journal History</CardTitle>
              <CardDescription>Tracked rounds and notes-only rounds appear together here.</CardDescription>
            </CardHeader>
            <CardContent>
              {notesWithContent.length === 0 ? (
                <div className="rounded-md border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">No saved round notes yet.</div>
              ) : (
                <div className="divide-y rounded-md border">
                  {notesWithContent.slice(0, 12).map((reflection) => {
                    const partners = partnerNames(reflection.playingPartnerIds);
                    const preview = noteText(reflection);
                    return (
                      <div key={reflection.roundDate} className="grid gap-3 p-4 md:grid-cols-[150px_1fr_auto] md:items-center">
                        <div>
                          <div className="flex items-center gap-2 font-semibold">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            {reflection.roundDate}
                          </div>
                          <Badge variant="outline" className="mt-2">{shotDates.has(reflection.roundDate) ? 'Tracked round' : 'Notes only'}</Badge>
                        </div>
                        <div className="min-w-0">
                          {partners.length > 0 && <p className="mb-1 text-xs text-muted-foreground">Played with {partners.join(', ')}</p>}
                          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{preview || 'No written notes.'}</p>
                        </div>
                        {shotDates.has(reflection.roundDate) ? (
                          <Button variant="outline" size="sm" className="w-fit gap-2" onClick={() => openRound(reflection.roundDate)}>
                            <ExternalLink className="h-4 w-4" />
                            Open Review
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="w-fit" onClick={() => editInJournal(reflection.roundDate)}>
                            Edit
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <Accordion type="single" collapsible>
                <AccordionItem value="raw-notes" className="border-b-0">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Raw Last 5 Notes
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="rounded-md border bg-muted/20 p-4">
                      <pre className="max-h-[420px] whitespace-pre-wrap text-left text-sm leading-6 text-foreground">{summaryText || 'No round notes saved yet.'}</pre>
                    </div>
                    <Button className="mt-4 gap-2" onClick={() => void copyRawNotes()} disabled={!summaryText}>
                      <Copy className="h-4 w-4" />
                      Copy Raw Notes
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
