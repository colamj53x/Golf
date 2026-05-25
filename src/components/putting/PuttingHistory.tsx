import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2 } from 'lucide-react';
import { PuttingSessionRecord } from '@/types/putting';
import { format, startOfWeek } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  sessions: PuttingSessionRecord[];
  onChanged: () => void;
}

export function PuttingHistory({ sessions, onChanged }: Props) {
  const chartData = useMemo(() => {
    return [...sessions]
      .sort((a, b) => a.session_date.localeCompare(b.session_date))
      .map(s => ({
        date: format(new Date(s.session_date), 'MMM d'),
        score: Number(s.total_score),
      }));
  }, [sessions]);

  const weekly = useMemo(() => {
    const map = new Map<string, { weekStart: string; count: number; total: number; best: number }>();
    for (const s of sessions) {
      const ws = format(startOfWeek(new Date(s.session_date), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const score = Number(s.total_score);
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
    const { error } = await supabase.from('putting_sessions').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete');
      return;
    }
    toast.success('Session deleted');
    onChanged();
  };

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No sessions yet. Start your first one above.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Score Trend</CardTitle>
          <CardDescription>Total score over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
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
                <TableHead className="text-right">Avg score</TableHead>
                <TableHead className="text-right">Best</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weekly.map(w => (
                <TableRow key={w.weekStart}>
                  <TableCell>{format(new Date(w.weekStart), 'PP')}</TableCell>
                  <TableCell className="text-right">{w.count}</TableCell>
                  <TableCell className="text-right">{Math.round(w.total / w.count)}</TableCell>
                  <TableCell className="text-right font-semibold">{w.best}</TableCell>
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
            {sessions.map(s => (
              <div key={s.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{format(new Date(s.session_date), 'PP')}</span>
                    {s.level && <Badge variant="secondary">{s.level}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Best: {s.best_drill ?? '—'} · Weakest: {s.weakest_drill ?? '—'} · Miss: {s.main_miss ?? '—'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-mono text-lg font-bold">{s.total_score}</div>
                    <div className="text-xs text-muted-foreground">/ {s.max_total}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
