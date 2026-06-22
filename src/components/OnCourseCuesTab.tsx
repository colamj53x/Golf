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
  return (
    <div className="space-y-7">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-2xl"><Crosshair className="h-6 w-6" />On-Course Cues</CardTitle>
          <CardDescription className="text-base">One short cue per shot. Tap a large card for the complete reference.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(card => (
            <button
              key={card.id}
              type="button"
              onClick={() => setParams({ cue: card.id })}
              className={`min-h-28 rounded-xl border p-4 text-left transition hover:border-primary hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected?.id === card.id ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary' : 'bg-card'}`}
            >
              <div className="text-lg font-bold leading-tight">{card.title}</div>
              <p className="mt-3 text-sm font-medium leading-relaxed text-foreground/80">{card.courseCue}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      {selected && (
        <Card className="border-primary/30 shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-2xl sm:text-3xl">{selected.title}</CardTitle>
              {configKey && <Badge variant="outline">{getConfigDisplayName(configKey)}</Badge>}
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/10 p-4 text-lg font-bold leading-relaxed text-foreground">
              {selected.courseCue}
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            {[
              ['Pre-shot', selected.preShot],
              ['Set-up', selected.setup],
              ['Look', selected.look],
              ...('clock' in selected && selected.clock ? [['Swing size', selected.clock]] : []),
              ['Swing', selected.swing],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl border bg-muted/20 p-4 sm:p-5">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{label}</div>
                <p className="mt-3 text-base font-semibold leading-relaxed text-foreground">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
