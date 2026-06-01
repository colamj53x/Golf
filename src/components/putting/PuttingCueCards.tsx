import { BookOpen, Crosshair, Waves } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const groups = [
  {
    title: 'Read',
    icon: BookOpen,
    cues: [
      ['Read from behind', 'See the whole putt. Call uphill or downhill, slope, and likely break.'],
      ['Check the low side', 'Walk the low side if needed. Confirm how much the ball will fall.'],
      ['Read the finish', 'Look at the final 1-2 m. Pick the entry point.'],
      ['Build the line', 'Trace the curve back to the ball and choose a start spot.'],
    ],
  },
  {
    title: 'Setup',
    icon: Crosshair,
    cues: [
      ['Face first', 'Set the putter face to the start spot before setting your body.'],
      ['Feet and eyes', 'Set feet square-ish, with eyes over or just inside the ball.'],
      ['Stable base', 'Favour the lead side slightly. Keep the body quiet.'],
      ['Ball position', 'Play it slightly forward of centre to encourage clean roll.'],
    ],
  },
  {
    title: 'Stroke',
    icon: Waves,
    cues: [
      ['Look at the target', 'Let your eyes collect the distance.'],
      ['Match the practice stroke', 'Rehearse the required pace before stepping in.'],
      ['Quiet hands', 'Rock the shoulders and keep grip pressure soft.'],
      ['Hold the finish', 'Finish still and listen for the ball.'],
    ],
  },
];

export function PuttingCueCards() {
  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardHeader>
        <CardTitle>Putting Cue Cards</CardTitle>
        <CardDescription>Use the same simple sequence before practice and before a round: read, setup, stroke.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-3">
        {groups.map(({ title, icon: Icon, cues }) => (
          <div key={title} className="rounded-lg border bg-background p-4">
            <div className="flex items-center gap-2 font-semibold text-emerald-900"><Icon className="h-4 w-4" /> {title}</div>
            <ol className="mt-3 space-y-3">
              {cues.map(([cue, detail], index) => (
                <li key={cue} className="grid grid-cols-[1.25rem_1fr] gap-2 text-sm">
                  <span className="font-mono text-xs font-bold text-emerald-700">{index + 1}</span>
                  <span><strong className="block text-foreground">{cue}</strong><span className="text-xs text-muted-foreground">{detail}</span></span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
