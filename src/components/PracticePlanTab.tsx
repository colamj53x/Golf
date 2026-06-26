import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Download, Loader2, Target } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePracticeData } from '@/context/PracticeDataContext';
import { usePracticeShotsBySessions } from '@/hooks/usePracticeShotsBySessions';
import { getEnabledShotFamilyOptions, getEnabledSwingEffortOptions } from '@/lib/shotOptions';
import { useShotProfiles } from '@/lib/shotProfiles';
import { buildRangeReferenceRows, type RangeReferenceRow } from '@/lib/rangeFocus';
import { resolveShotCue, useShotCues } from '@/lib/shotCues';
import { SHOT_TECHNIQUE_INTRO } from '@/lib/shotTechniqueNotes';
import { PRACTICE_CLUBS, getConfigDisplayName } from '@/types/practiceClubs';
import type { MetricStatus } from '@/types/practice';

function statusClasses(status: MetricStatus | null): string {
  if (status === 'green') return 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300';
  if (status === 'amber') return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  if (status === 'red') return 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300';
  return 'border-border bg-muted/40 text-muted-foreground';
}

function statusText(row: RangeReferenceRow): string {
  if (row.latest18Pct === null) return 'No recent score';
  return `${row.latest18Pct}% in target`;
}

function SwingTargetsTable({ rows }: { rows: RangeReferenceRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section className="space-y-2">
      <div>
        <h3 className="font-semibold">Swing and flight checks</h3>
        <p className="text-xs text-muted-foreground">
          Inputs first. Check these before using distance or dispersion to judge the shot.
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="w-[42%] px-3 py-2 text-left font-semibold">Check</th>
              <th className="w-[28%] px-3 py-2 text-left font-semibold">Target</th>
              <th className="w-[30%] px-3 py-2 text-left font-semibold">Latest 18</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.metricId} data-pdf-break className="border-t">
                <td className="px-3 py-2.5 font-medium">{row.metricName}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums">{row.target}</td>
                <td className="px-3 py-2.5">
                  <Badge variant="outline" className={`whitespace-nowrap ${statusClasses(row.status)}`}>
                    {statusText(row)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OutcomeTable({ rows }: { rows: RangeReferenceRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section className="space-y-2">
      <div>
        <h3 className="font-semibold">Outcome confirmation</h3>
        <p className="text-xs text-muted-foreground">
          Keep these visible so each shot can be compared with the profile outcome.
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="w-1/2 px-3 py-2 text-left font-semibold">Outcome</th>
              <th className="w-1/2 px-3 py-2 text-left font-semibold">Target</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.metricId} data-pdf-break className="border-t">
                <td className="px-3 py-2.5 font-medium">{row.metricName}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums">{row.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TechniqueNotes({ title, notes }: { title: string; notes: Array<{ label: string; text: string }> }) {
  return (
    <section className="space-y-4 border-t pt-6">
      <div data-pdf-break-before>
        <h3 className="text-xl font-semibold">Full shot technique - {title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">The complete practice card for this exact club, shot and power.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {SHOT_TECHNIQUE_INTRO.map(item => (
          <div key={item.label} data-pdf-break className="rounded-lg border border-primary/25 bg-primary/5 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">{item.label}</div>
            <p className="mt-1.5 text-sm leading-relaxed">{item.text}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-x-5 gap-y-3 md:grid-cols-2">
        {notes.map(note => (
          <div key={note.label} data-pdf-break className="rounded-lg border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">{note.label}</div>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground">{note.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PdfTargets({ outcomeRows, swingRows }: { outcomeRows: RangeReferenceRow[]; swingRows: RangeReferenceRow[] }) {
  return <div className="space-y-4">
    <section>
      <h3 className="text-sm font-bold">Outcome confirmation</h3>
      <table className="mt-1.5 w-full border-collapse overflow-hidden rounded-md border text-[10px]">
        <thead className="bg-slate-100"><tr><th className="px-2 py-1.5 text-left">Outcome</th><th className="px-2 py-1.5 text-left">Target</th></tr></thead>
        <tbody>{outcomeRows.map(row => <tr key={row.metricId} data-pdf-break className="border-t"><td className="px-2 py-1.5 font-medium">{row.metricName}</td><td className="px-2 py-1.5 font-bold">{row.target}</td></tr>)}</tbody>
      </table>
    </section>
    <section>
      <h3 className="text-sm font-bold">Swing and flight targets</h3>
      <p className="mt-0.5 text-[9px] text-slate-500">Check each shot against these numbers.</p>
      <table className="mt-1.5 w-full border-collapse overflow-hidden rounded-md border text-[10px]">
        <thead className="bg-slate-100"><tr><th className="px-2 py-1.5 text-left">Check</th><th className="px-2 py-1.5 text-left">Target</th><th className="px-2 py-1.5 text-left">Latest 18</th></tr></thead>
        <tbody>{swingRows.map(row => <tr key={row.metricId} data-pdf-break className="border-t"><td className="px-2 py-1.5 font-medium">{row.metricName}</td><td className="whitespace-nowrap px-2 py-1.5 font-bold">{row.target}</td><td className="px-2 py-1.5">{statusText(row)}</td></tr>)}</tbody>
      </table>
    </section>
  </div>;
}

function PdfTechnique({ notes }: { notes: Array<{ label: string; text: string }> }) {
  const filteredNotes = notes.filter(note => note.label !== 'Pre-shot routine');
  return <section>
    <h3 className="text-sm font-bold">Full shot technique</h3>
    <p className="mt-0.5 text-[9px] text-slate-500">Complete setup and swing words for this shot.</p>
    <div className="mt-2 grid grid-cols-2 gap-1.5">
      {SHOT_TECHNIQUE_INTRO.map(item => <div key={item.label} data-pdf-break className="rounded-md border border-emerald-200 bg-emerald-50 p-2"><div className="text-[8px] font-bold uppercase tracking-wide text-emerald-800">{item.label}</div><p className="mt-1 text-[9px] leading-[1.3]">{item.text}</p></div>)}
      {filteredNotes.map(note => <div key={note.label} data-pdf-break className={`rounded-md border p-2 ${note.label === 'Shot goal' ? 'col-span-2' : ''}`}><div className="text-[8px] font-bold uppercase tracking-wide text-emerald-800">{note.label}</div><p className="mt-1 text-[9px] leading-[1.3]">{note.text}</p></div>)}
    </div>
  </section>;
}

export function PracticePlanTab() {
  const pdfContentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const shotProfiles = useShotProfiles();
  const shotCues = useShotCues();
  const {
    practiceConfigs,
    getSessionsForClub,
    selectedClub,
    selectedShotType,
    selectedPower,
    setSelectedClub,
    setSelectedShotType,
    setSelectedPower,
    currentConfigKey,
  } = usePracticeData();

  const shotTypeOptions = useMemo(
    () => getEnabledShotFamilyOptions(shotProfiles, selectedClub, 'practice'),
    [selectedClub, shotProfiles],
  );
  const powerOptions = useMemo(
    () => getEnabledSwingEffortOptions(shotProfiles, selectedClub, selectedShotType, 'practice'),
    [selectedClub, selectedShotType, shotProfiles],
  );

  useEffect(() => {
    if (!shotTypeOptions.length || shotTypeOptions.some(option => option.value === selectedShotType)) return;
    setSelectedShotType(shotTypeOptions[0].value);
  }, [selectedShotType, setSelectedShotType, shotTypeOptions]);

  useEffect(() => {
    if (!powerOptions.length || powerOptions.some(option => option.value === selectedPower)) return;
    setSelectedPower(powerOptions[0].value);
  }, [powerOptions, selectedPower, setSelectedPower]);

  const config = practiceConfigs.find(candidate => candidate.clubId === currentConfigKey) ?? null;
  const sessions = getSessionsForClub(currentConfigKey);
  const sessionIds = sessions.map(session => session.id);
  const { shotsBySession } = usePracticeShotsBySessions(sessionIds);
  const recentShots = useMemo(
    () => sessions.flatMap(session => shotsBySession[session.id] ?? []).slice(0, 18),
    [sessions, shotsBySession],
  );
  const rows = useMemo(
    () => config ? buildRangeReferenceRows(config.metrics, recentShots, currentConfigKey) : [],
    [config, currentConfigKey, recentShots],
  );
  const swingRows = rows.filter(row => row.section === 'swing');
  const outcomeRows = rows.filter(row => row.section === 'outcome');
  const shotCue = resolveShotCue(shotCues, currentConfigKey);
  const pdfPreShot = shotCue?.technique.find(note => note.label === 'Pre-shot routine')?.text ?? '';

  const exportToPDF = async () => {
    if (!pdfContentRef.current) return;
    setIsExporting(true);

    try {
      const canvas = await html2canvas(pdfContentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const margin = 8;
      const availableWidth = pdf.internal.pageSize.getWidth() - (margin * 2);
      const availableHeight = pdf.internal.pageSize.getHeight() - (margin * 2);
      const renderedWidth = availableWidth * 0.9;
      const pageX = (pdf.internal.pageSize.getWidth() - renderedWidth) / 2;
      const maxSliceHeight = canvas.width * (availableHeight / renderedWidth);
      const contentRect = pdfContentRef.current.getBoundingClientRect();
      const canvasScale = canvas.width / pdfContentRef.current.offsetWidth;
      const breakAfter = Array.from(pdfContentRef.current.querySelectorAll<HTMLElement>('[data-pdf-break]'))
        .map(element => (element.getBoundingClientRect().bottom - contentRect.top) * canvasScale)
      const breakBefore = Array.from(pdfContentRef.current.querySelectorAll<HTMLElement>('[data-pdf-break-before]'))
        .map(element => (element.getBoundingClientRect().top - contentRect.top) * canvasScale)
      const breakpoints = [...breakAfter, ...breakBefore]
        .filter(point => point > 0 && point < canvas.height)
        .sort((a, b) => a - b);
      let sliceStart = 0;
      let pageIndex = 0;

      while (sliceStart < canvas.height - 1) {
        const idealEnd = Math.min(sliceStart + maxSliceHeight, canvas.height);
        const safeBreaks = breakpoints.filter(point => point > sliceStart + (maxSliceHeight * 0.55) && point <= idealEnd);
        const sliceEnd = idealEnd === canvas.height ? canvas.height : (safeBreaks.at(-1) ?? idealEnd);
        const sliceHeight = Math.max(1, Math.floor(sliceEnd - sliceStart));
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const context = pageCanvas.getContext('2d');
        if (!context) throw new Error('Could not prepare PDF page');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        context.drawImage(canvas, 0, Math.floor(sliceStart), canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
        if (pageIndex > 0) pdf.addPage('a4', 'landscape');
        const renderedHeight = renderedWidth * (sliceHeight / canvas.width);
        pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.88), 'JPEG', pageX, margin, renderedWidth, renderedHeight, undefined, 'FAST');
        sliceStart = sliceEnd;
        pageIndex += 1;
      }
      const date = new Date().toISOString().split('T')[0];
      pdf.save(`range-${currentConfigKey.replace(/_/g, '-')}-reference-${date}.pdf`);
    } catch (error) {
      console.error('Error exporting range reference PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (!config) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No practice reference is available for this profile.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Range Reference</CardTitle>
              <CardDescription className="mt-1">
                Choose the club and shot profile you are taking to the range.
              </CardDescription>
            </div>
            <Button variant="outline" className="gap-2" onClick={exportToPDF} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isExporting ? 'Creating PDF...' : 'Save PDF'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Club</label>
              <Select value={selectedClub} onValueChange={setSelectedClub}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Club" /></SelectTrigger>
                <SelectContent>
                  {PRACTICE_CLUBS.map(club => <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Shot</label>
              <Select value={selectedShotType} onValueChange={setSelectedShotType}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Shot" /></SelectTrigger>
                <SelectContent>
                  {shotTypeOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Power</label>
              <Select value={selectedPower} onValueChange={setSelectedPower}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Power" /></SelectTrigger>
                <SelectContent>
                  {powerOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="range-reference-card practice-reference-print mx-auto max-w-6xl shadow-sm print:max-w-none print:border-0 print:shadow-none">
        <CardHeader className="border-b pb-4 print:px-0 print:pt-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
                <BookOpen className="h-4 w-4" />
                Six-shot range reference
              </div>
              <CardTitle className="text-2xl">{getConfigDisplayName(currentConfigKey)}</CardTitle>
              <CardDescription className="mt-2 max-w-3xl">
                After each shot, compare the monitor result with the target.
              </CardDescription>
            </div>
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
              <Target className="h-3.5 w-3.5" />
              {recentShots.length > 0 ? `Latest ${recentShots.length} shots` : 'Targets only'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-5 print:px-0 print:pt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <OutcomeTable rows={outcomeRows} />
            <SwingTargetsTable rows={swingRows} />
          </div>
          {shotCue && <TechniqueNotes title={getConfigDisplayName(currentConfigKey)} notes={shotCue.technique} />}
        </CardContent>
      </Card>

      <div aria-hidden="true" className="pointer-events-none fixed left-[-20000px] top-0 w-[1120px]">
        <div ref={pdfContentRef} className="w-[1120px] border bg-white p-6 text-slate-950">
          <header className="border-b pb-4">
            <div className="flex items-start justify-between gap-4">
              <div><div className="text-xs font-semibold text-emerald-700">Six-shot range reference</div><h2 className="mt-1 text-2xl font-bold">{getConfigDisplayName(currentConfigKey)}</h2></div>
              <div className="rounded-full border px-3 py-1 text-[10px] font-semibold">{recentShots.length > 0 ? `Latest ${recentShots.length} shots` : 'Targets only'}</div>
            </div>
            {pdfPreShot && <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3"><div className="text-[9px] font-bold uppercase tracking-wide text-emerald-800">Pre-shot routine</div><p className="mt-1 text-[11px] leading-[1.4]">{pdfPreShot}</p></div>}
          </header>
          <main className="space-y-5 pt-4">
            <div className="grid grid-cols-[0.42fr_0.58fr] gap-5">
              <PdfTargets outcomeRows={outcomeRows} swingRows={swingRows} />
              {shotCue && <PdfTechnique notes={shotCue.technique} />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
