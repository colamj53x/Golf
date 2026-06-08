import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarDays, CheckCircle, Copy, ExternalLink, FileText, PenLine, Save } from 'lucide-react';
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
import {
  JournalReflection,
  loadJournalReflections,
  saveJournalReflection,
} from '@/lib/journalReflectionsRepository';

const NOTE_FIELDS = [
  ['generalComments', 'Comments'],
  ['drivingNotes', 'Driving'],
  ['ironsNotes', 'Irons and Hybrids'],
  ['shortNotes', 'Short Game'],
  ['puttingNotes', 'Putting'],
  ['mentalNotes', 'Mental'],
  ['courseManagementNotes', 'Course Management'],
] as const;

function noteText(reflection: { [key: string]: string | string[] }): string {
  return NOTE_FIELDS
    .map(([key]) => reflection[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .trim();
}

export function JournalTab() {
  const { user } = useAuth();
  const { shots, roundReflections, playingPartners, setPlayingPartners, refreshRoundReflections, upsertRoundReflection } = useGolfData();
  const navigate = useNavigate();
  const [journalReflections, setJournalReflections] = useState<JournalReflection[]>([]);
  const [roundNoteDate, setRoundNoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [roundNoteDraft, setRoundNoteDraft] = useState<RoundReflectionDraft>(createEmptyRoundReflectionDraft());
  const [roundNoteStatus, setRoundNoteStatus] = useState<string | null>(null);
  const [isSavingRoundNote, setIsSavingRoundNote] = useState(false);
  const [reflectionDate, setReflectionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reflectionTitle, setReflectionTitle] = useState('');
  const [reflectionBody, setReflectionBody] = useState('');
  const [isSavingReflection, setIsSavingReflection] = useState(false);

  const shotDates = useMemo(() => new Set(shots.map((shot) => getShotDateKey(shot.date))), [shots]);
  const notesWithContent = useMemo(() => roundReflections
    .filter((reflection) => noteText(reflection).length > 0 || reflection.playingPartnerIds.length > 0)
    .sort((a, b) => b.roundDate.localeCompare(a.roundDate)), [roundReflections]);
  const lastFiveNotes = notesWithContent.slice(0, 5);

  useEffect(() => {
    if (!user) {
      setJournalReflections([]);
      return;
    }

    let cancelled = false;
    loadJournalReflections(user.id)
      .then((rows) => {
        if (!cancelled) setJournalReflections(rows);
      })
      .catch((error) => {
        if (import.meta.env.DEV) console.error('Failed to load journal reflections:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

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

  const copySummary = async () => {
    await navigator.clipboard.writeText(summaryText || 'No round notes saved yet.');
    toast.success('Last 5 round notes copied');
  };

  const saveReflection = async () => {
    if (!user) {
      toast.error('Sign in before saving a journal reflection');
      return;
    }
    if (!reflectionDate || !reflectionBody.trim()) {
      toast.error('Add a date and reflection before saving');
      return;
    }

    setIsSavingReflection(true);
    try {
      await saveJournalReflection(user.id, reflectionDate, {
        title: reflectionTitle.trim(),
        body: reflectionBody.trim(),
        linkedRoundDates: lastFiveNotes.map((note) => note.roundDate),
      });
      const rows = await loadJournalReflections(user.id);
      setJournalReflections(rows);
      setReflectionTitle('');
      setReflectionBody('');
      toast.success('Journal reflection saved');
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to save journal reflection:', error);
      toast.error('Could not save the journal reflection');
    } finally {
      setIsSavingReflection(false);
    }
  };

  const openRound = (roundDate: string) => {
    navigate(`/review/rounds?round=${encodeURIComponent(roundDate)}`);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
              <BookOpen className="h-4 w-4" />
              Golf Journal
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">Round notes, patterns, and reflections</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Notes written on Review are collected here automatically. Use the last-five summary as your clean export, then save your own dated reflection after you have thought it through.
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => void refreshRoundReflections()}>
            <CheckCircle className="h-4 w-4" />
            Refresh Notes
          </Button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <Card>
          <CardHeader>
            <CardTitle>New Round Note</CardTitle>
            <CardDescription>Use this for a round you played without tracking shots. Tracked-round notes can still be written from Review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div className="flex justify-end">
              <Button className="gap-2" onClick={() => void saveRoundNote()} disabled={isSavingRoundNote}>
                <Save className="h-4 w-4" />
                {isSavingRoundNote ? 'Saving...' : 'Save Round Note'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Last 5 Round Notes
            </CardTitle>
            <CardDescription>Copy this block into another AI tool, then save your distilled reflection below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/20 p-4">
              <pre className="max-h-[420px] whitespace-pre-wrap text-sm leading-6 text-foreground">{summaryText || 'No round notes saved yet.'}</pre>
            </div>
            <div className="flex justify-end">
              <Button className="gap-2" onClick={() => void copySummary()} disabled={!summaryText}>
                <Copy className="h-4 w-4" />
                Copy Summary
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenLine className="h-5 w-5" />
              New Reflection
            </CardTitle>
            <CardDescription>A dated reflection is separate from a round note. It captures what you learned.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
              <div className="space-y-2">
                <Label htmlFor="journal-reflection-date">Date</Label>
                <Input id="journal-reflection-date" type="date" value={reflectionDate} onChange={(event) => setReflectionDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="journal-reflection-title">Title</Label>
                <Input id="journal-reflection-title" value={reflectionTitle} onChange={(event) => setReflectionTitle(event.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="journal-reflection-body">Reflection</Label>
              <Textarea
                id="journal-reflection-body"
                value={reflectionBody}
                onChange={(event) => setReflectionBody(event.target.value)}
                placeholder="What are the repeated patterns, decisions, feels, and next commitments?"
                className="min-h-[220px]"
              />
            </div>
            <Button className="w-full gap-2" onClick={() => void saveReflection()} disabled={isSavingReflection}>
              <Save className="h-4 w-4" />
              {isSavingReflection ? 'Saving...' : 'Save Reflection'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Round Notes</CardTitle>
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
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => openRound(reflection.roundDate)}>
                      <ExternalLink className="h-4 w-4" />
                      Open Review
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved Reflections</CardTitle>
          <CardDescription>Your dated reflections after reviewing round-note patterns.</CardDescription>
        </CardHeader>
        <CardContent>
          {journalReflections.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">No reflections saved yet.</div>
          ) : (
            <div className="space-y-3">
              {journalReflections.map((reflection) => (
                <article key={reflection.id} className="rounded-md border p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold">{reflection.title || 'Untitled reflection'}</h3>
                      <p className="text-xs text-muted-foreground">{reflection.reflectionDate}</p>
                    </div>
                    {reflection.linkedRoundDates.length > 0 && <Badge variant="secondary">{reflection.linkedRoundDates.length} linked rounds</Badge>}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{reflection.body}</p>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
