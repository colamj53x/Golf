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

function ReferenceTable({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: RangeReferenceRow[];
}) {
  if (rows.length === 0) return null;

  return (
    <section className="space-y-2">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border print:overflow-visible">
        <table className="w-full min-w-[900px] border-collapse text-sm print:min-w-0 print:text-[10px]">
          <thead className="bg-muted/60">
            <tr>
              <th className="w-[15%] px-3 py-2 text-left font-semibold">Check</th>
              <th className="w-[13%] px-3 py-2 text-left font-semibold">Target</th>
              <th className="w-[14%] px-3 py-2 text-left font-semibold">Latest 18</th>
              <th className="w-[29%] px-3 py-2 text-left font-semibold">If low / left</th>
              <th className="w-[29%] px-3 py-2 text-left font-semibold">If high / right</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.metricId} data-pdf-break className="border-t align-top">
                <td className="px-3 py-3 font-medium print:py-2">{row.metricName}</td>
                <td className="whitespace-nowrap px-3 py-3 font-semibold tabular-nums print:py-2">{row.target}</td>
                <td className="px-3 py-3 print:py-2">
                  <Badge variant="outline" className={`whitespace-nowrap ${statusClasses(row.status)}`}>
                    {statusText(row)}
                  </Badge>
                </td>
                <td className="px-3 py-3 print:py-2">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                    {row.lowLabel}
                  </div>
                  <p className="leading-snug text-muted-foreground print:text-foreground">{row.lowTip}</p>
                </td>
                <td className="px-3 py-3 print:py-2">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">
                    {row.highLabel}
                  </div>
                  <p className="leading-snug text-muted-foreground print:text-foreground">{row.highTip}</p>
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

export function PracticePlanTab() {
  const contentRef = useRef<HTMLDivElement>(null);
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

  const exportToPDF = async () => {
    if (!contentRef.current) return;
    setIsExporting(true);

    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const margin = 8;
      const availableWidth = pdf.internal.pageSize.getWidth() - (margin * 2);
      const availableHeight = pdf.internal.pageSize.getHeight() - (margin * 2);
      const maxSliceHeight = canvas.width * (availableHeight / availableWidth);
      const contentRect = contentRef.current.getBoundingClientRect();
      const canvasScale = canvas.width / contentRef.current.offsetWidth;
      const breakAfter = Array.from(contentRef.current.querySelectorAll<HTMLElement>('[data-pdf-break]'))
        .map(element => (element.getBoundingClientRect().bottom - contentRect.top) * canvasScale)
      const breakBefore = Array.from(contentRef.current.querySelectorAll<HTMLElement>('[data-pdf-break-before]'))
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
        const renderedHeight = availableWidth * (sliceHeight / canvas.width);
        pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.88), 'JPEG', margin, margin, availableWidth, renderedHeight, undefined, 'FAST');
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

      <Card ref={contentRef} className="range-reference-card practice-reference-print mx-auto max-w-6xl shadow-sm print:max-w-none print:border-0 print:shadow-none">
        <CardHeader className="border-b pb-4 print:px-0 print:pt-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
                <BookOpen className="h-4 w-4" />
                Six-shot range reference
              </div>
              <CardTitle className="text-2xl">{getConfigDisplayName(currentConfigKey)}</CardTitle>
              <CardDescription className="mt-2 max-w-3xl">
                After each shot, compare the monitor result with the target. Read only the correction that matches the side of the miss.
              </CardDescription>
            </div>
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
              <Target className="h-3.5 w-3.5" />
              {recentShots.length > 0 ? `Latest ${recentShots.length} shots` : 'Targets only'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-5 print:px-0 print:pt-4">
          <div className="space-y-6">
            <OutcomeTable rows={outcomeRows} />
            <ReferenceTable title="Swing and flight checks" description="Inputs first. Check these before using distance or dispersion to judge the shot." rows={swingRows} />
          </div>
          {shotCue && <TechniqueNotes title={getConfigDisplayName(currentConfigKey)} notes={shotCue.technique} />}
        </CardContent>
      </Card>
    </div>
  );
}
