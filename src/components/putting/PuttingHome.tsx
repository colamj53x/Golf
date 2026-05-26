import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Eye, Flag, Footprints, Home, ScanLine, TreePine } from 'lucide-react';
import { PuttingDashboard } from './PuttingDashboard';

interface Props {
  onSelect: (category: 'indoor' | 'outdoor') => void;
}

const readSteps = [
  {
    title: 'Read from behind',
    detail: 'See the whole putt. Call the slope and break.',
    icon: Eye,
  },
  {
    title: 'Check the low side',
    detail: 'Feel the slope and choose small, medium, or big break.',
    icon: Footprints,
  },
  {
    title: 'Read the finish',
    detail: 'Look at the last 1-2m and pick the entry point.',
    icon: Flag,
  },
  {
    title: 'Build the line',
    detail: 'Choose speed, trace the curve back, pick the start spot.',
    icon: ScanLine,
  },
];

const techniqueSteps = [
  {
    title: 'Face first',
    detail: 'Aim the putter face at your start spot.',
    icon: ScanLine,
  },
  {
    title: 'Set around the face',
    detail: 'Ball forward, eyes over or inside, weight slightly lead side.',
    icon: Footprints,
  },
  {
    title: 'Feel the distance',
    detail: 'Look at the hole and make 1-2 matching practice strokes.',
    icon: Eye,
  },
  {
    title: 'Roll it',
    detail: 'Look at a dimple and brush slightly up through the ball.',
    icon: CheckCircle2,
  },
  {
    title: 'Hold the finish',
    detail: 'Finish near the front foot with the face down the line.',
    icon: Flag,
  },
];

export function PuttingHome({ onSelect }: Props) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant="outline">Read</Badge>
                <h3 className="mt-2 text-xl font-bold">Pre-Shot Routine</h3>
              </div>
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <Eye className="h-5 w-5" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {readSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="flex gap-3 rounded-md border bg-muted/20 p-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">{index + 1}. {step.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="rounded-md border bg-background p-3 text-sm">
              <p className="font-semibold">Start spot guide</p>
              <p className="mt-1 text-muted-foreground">Short 10-20cm · Medium 20-50cm · Long 50cm-1m</p>
            </div>
            <p className="rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
              Start it there. Roll it at that speed.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant="outline">Technique</Badge>
                <h3 className="mt-2 text-xl font-bold">Setup & Stroke</h3>
              </div>
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {techniqueSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.title}
                    className={`flex gap-3 rounded-md border bg-muted/20 p-3 ${
                      index === techniqueSteps.length - 1 ? 'sm:col-span-2' : ''
                    }`}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">{index + 1}. {step.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
              Face first. Feel it. Roll it. Finish.
            </p>
          </CardContent>
        </Card>
      </div>

      <PuttingDashboard />

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className="cursor-pointer transition hover:border-primary hover:shadow-md"
          onClick={() => onSelect('indoor')}
        >
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
            <Home className="h-12 w-12 text-primary" />
            <h3 className="text-xl font-bold">Indoor</h3>
            <p className="text-sm text-muted-foreground text-center">
              Carpet putting drills - Start Line & Short Putt Control
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-not-allowed opacity-60">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
            <TreePine className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-xl font-bold">Outdoor</h3>
            <p className="text-sm text-muted-foreground text-center">Coming soon</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
