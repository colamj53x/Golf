import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight, ImagePlus, Trash2 } from 'lucide-react';
import { DrillResult, PuttingSessionRecord } from '@/types/putting';
import { format, startOfWeek } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { compressPuttingScreenshot } from '@/lib/putting/screenshots';

interface Props {
  sessions: PuttingSessionRecord[];
  onChanged: () => void;
}

function sessionPercent(session: PuttingSessionRecord): number {
  return session.max_total > 0
    ? Math.round((Number(session.total_score) / Number(session.max_total)) * 100)
    : 0;
}

export function PuttingHistory({ sessions, onChanged }: Props) {
  const { user } = useAuth();
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [uploadingDrillId, setUploadingDrillId] = useState<string | null>(null);
  const chartData = useMemo(() => {
    return [...sessions]
      .sort((a, b) => a.session_date.localeCompare(b.session_date))
      .map(s => ({
        date: format(new Date(s.session_date), 'MMM d'),
        score: sessionPercent(s),
      }));
  }, [sessions]);

  const weekly = useMemo(() => {
    const map = new Map<string, { weekStart: string; count: number; total: number; best: number }>();
    for (const s of sessions) {
      const ws = format(startOfWeek(new Date(s.session_date), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const score = sessionPercent(s);
      const existing = map.get(ws);
      if (existing) {
        existing.count += 1;
        existing.total += score;
        existing.best = Math.max(existing.best, score);
      } else {
        map.set(ws, { weekStart: ws, count: 1, total: score, best: score });
      }
    }
    return [...map.values()].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }, [sessions]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this session?')) return;
    if (!user) return;
    const { error } = await supabase
      .from('putting_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) {
      toast.error('Failed to delete');
      return;
    }
    toast.success('Session deleted');
    onChanged();
  };

  const handleBlastUpload = async (session: PuttingSessionRecord, result: DrillResult, files: File[]) => {
    if (!user || !files.length) return;
    setUploadingDrillId(`${session.id}:${result.drill_id}`);
    try {
      const screenshots = await Promise.all(files.map(compressPuttingScreenshot));
      const nextResults = session.drill_results.map((item) => item.drill_id === result.drill_id ? {
        ...item,
        blast: {
          ...item.blast,
          screenshot_data_urls: [...(item.blast?.screenshot_data_urls || []), ...screenshots],
          screenshot_names: [...(item.blast?.screenshot_names || []), ...files.map((file) => file.name)],
        },
      } : item);
      const { error } = await supabase
        .from('putting_sessions')
        .update({ drill_results: JSON.parse(JSON.stringify(nextResults)) })
        .eq('id', session.id)
        .eq('user_id', user.id);
      if (error) throw error;
      toast.success('Blast screenshots added');
      onChanged();
    } catch {
      toast.error('Failed to add Blast screenshots');
    } finally {
      setUploadingDrillId(null);
    }
  };

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No sessions yet. Start one from the Drills page.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Score Trend</CardTitle>
          <CardDescription>Session percentage over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week starting</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Avg</TableHead>
                <TableHead className="text-right">Best</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weekly.map(w => (
                <TableRow key={w.weekStart}>
                  <TableCell>{format(new Date(w.weekStart), 'PP')}</TableCell>
                  <TableCell className="text-right">{w.count}</TableCell>
                  <TableCell className="text-right">{Math.round(w.total / w.count)}%</TableCell>
                  <TableCell className="text-right font-semibold">{w.best}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sessions.map(s => {
              const expanded = expandedSessionId === s.id;
              return (
              <div key={s.id} className="rounded-md border">
                <div className="flex items-center justify-between gap-3 p-3">
                  <Button variant="ghost" size="icon" onClick={() => setExpandedSessionId(expanded ? null : s.id)} aria-label={expanded ? 'Hide session drills' : 'Show session drills'}>
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{format(new Date(s.session_date), 'PP')}</span>
                      {s.level && <Badge variant="secondary">{s.level}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Best: {s.best_drill ?? '—'} · Weakest: {s.weakest_drill ?? '—'} · Miss: {s.main_miss ?? '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-lg font-bold">{s.total_score}</div>
                    <div className="text-xs text-muted-foreground">/ {s.max_total} · {sessionPercent(s)}%</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {expanded && (
                  <div className="space-y-2 border-t bg-muted/10 p-3">
                    <p className="text-xs text-muted-foreground">Open a drill to add Blast Motion screenshots after the session. Existing scores are not changed.</p>
                    {s.drill_results.map((result) => {
                      const screenshotCount = result.blast?.screenshot_data_urls?.length || (result.blast?.screenshot_data_url ? 1 : 0);
                      const uploadKey = `${s.id}:${result.drill_id}`;
                      return (
                        <div key={result.drill_id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3">
                          <div>
                            <div className="text-sm font-semibold">{result.drill_name}</div>
                            <div className="text-xs text-muted-foreground">{result.final_score} / {result.max_score} · {screenshotCount} Blast screenshot{screenshotCount === 1 ? '' : 's'}</div>
                          </div>
                          <Label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted">
                            <ImagePlus className="h-4 w-4" />
                            {uploadingDrillId === uploadKey ? 'Adding...' : 'Add Blast screenshots'}
                            <Input className="hidden" type="file" accept="image/*" multiple disabled={uploadingDrillId === uploadKey} onChange={async (event) => {
                              await handleBlastUpload(s, result, [...(event.target.files || [])]);
                              event.target.value = '';
                            }} />
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
