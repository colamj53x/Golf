import { Crosshair } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { resolveShotCue, useShotCues, type ShotCueId } from '@/lib/shotCues';
import { getConfigDisplayName } from '@/types/practiceClubs';

export function OnCourseCuesTab() {
  const cards = useShotCues();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('cue') as ShotCueId | null;
  const configKey = params.get('config') || '';
  const selected = configKey ? resolveShotCue(cards, configKey) : cards.find(card => card.id === selectedId) ?? null;
  return <div className="space-y-5"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Crosshair className="h-5 w-5" />Simplified On-Course Cue List</CardTitle><CardDescription>One short cue per shot. Tap a card for the complete reference.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(card => <button key={card.id} type="button" onClick={() => setParams({ cue: card.id })} className={`rounded-lg border p-3 text-left hover:border-primary ${selected?.id === card.id ? 'border-primary bg-primary/5' : ''}`}><div className="font-semibold">{card.title}</div><p className="mt-1 text-sm text-muted-foreground">{card.courseCue}</p></button>)}</CardContent></Card>
    {selected && <Card><CardHeader><div className="flex flex-wrap items-center gap-2"><CardTitle>{selected.title}</CardTitle>{configKey && <Badge variant="outline">{getConfigDisplayName(configKey)}</Badge>}</div><CardDescription className="text-base font-medium text-foreground">{selected.courseCue}</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">{[['Pre-shot', selected.preShot], ['Set-up', selected.setup], ['Look', selected.look], ...('clock' in selected && selected.clock ? [['Swing size', selected.clock]] : []), ['Swing', selected.swing]].map(([label, value]) => <div key={label as string} className="rounded-md border p-3"><div className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</div><p className="mt-1 text-sm">{value}</p></div>)}</CardContent></Card>}
  </div>;
}
