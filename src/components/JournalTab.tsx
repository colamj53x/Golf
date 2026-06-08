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
  const [roundNoteDate, setRoundNoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [roundNoteDraft, setRoundNoteDraft] = useState<RoundReflectionDraft>(createEmptyRoundReflectionDraft());
  const [roundNoteStatus, setRoundNoteStatus] = useState<string | null>(null);
  const [isSavingRoundNote, setIsSavingRoundNote] = useState(false);

  const shotDates = useMemo(() => new Set(shots.map((shot) => getShotDateKey(shot.date))), [shots]);
  const notesWithContent = useMemo(() => roundReflections
    .filter((reflection) => noteText(reflection).length > 0 || reflection.playingPartnerIds.length > 0)
    .sort((a, b) => b.roundDate.localeCompare(a.roundDate)), [roundReflections]);
  const lastFiveNotes = notesWithContent.slice(0, 5);
  const latestNote = notesWithContent[0] ?? null;

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

  const copySummary = async () => {
    await navigator.clipboard.writeText(summaryText || 'No round notes saved yet.');
    toast.success('Last 5 round notes copied');
  };

  const openRound = (roundDate: string) => {
    navigate(`/review/rounds?round=${encodeURIComponent(roundDate)}`);
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
          <CardTitle>Latest Round Note</CardTitle>
          <CardDescription>The newest round note appears here first.</CardDescription>
        </CardHeader>
        <CardContent>
          {latestNote ? (() => {
            const partners = partnerNames(latestNote.playingPartnerIds);
            const preview = noteText(latestNote);
            return (
              <div className="grid gap-4 md:grid-cols-[160px_1fr_auto] md:items-start">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    {latestNote.roundDate}
                  </div>
                  <Badge variant="outline" className="mt-2">
                    {shotDates.has(latestNote.roundDate) ? 'Tracked round' : 'Notes only'}
                  </Badge>
                </div>
                <div className="min-w-0 space-y-2">
                  {partners.length > 0 && <p className="text-xs text-muted-foreground">Played with {partners.join(', ')}</p>}
                  <p className="text-sm leading-6 text-muted-foreground">{preview || 'No written notes.'}</p>
                </div>
                <Button variant="outline" size="sm" className="w-fit gap-2" onClick={() => openRound(latestNote.roundDate)}>
                  <ExternalLink className="h-4 w-4" />
                  Open Review
                </Button>
              </div>
            );
          })() : (
            <div className="rounded-md border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">No saved round notes yet.</div>
          )}
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>New Notes-Only Round</CardTitle>
              <CardDescription>For a round you played without tracking shots.</CardDescription>
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
                        <Button variant="outline" size="sm" className="w-fit gap-2" onClick={() => openRound(reflection.roundDate)}>
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
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Last 5 Round Notes
              </CardTitle>
              <CardDescription>Copy this block, then save your own dated reflection below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border bg-muted/20 p-4">
                <pre className="max-h-[420px] whitespace-pre-wrap text-left text-sm leading-6 text-foreground">{summaryText || 'No round notes saved yet.'}</pre>
              </div>
              <div className="flex justify-start">
                <Button className="gap-2" onClick={() => void copySummary()} disabled={!summaryText}>
                  <Copy className="h-4 w-4" />
                  Copy Summary
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
