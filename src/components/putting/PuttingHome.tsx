import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, CheckCircle2, ClipboardList, Eye, Flag, Footprints, ListChecks, Play, ScanLine, TreePine } from 'lucide-react';
import { PuttingTracking } from './PuttingTracking';
import { INDOOR_PRACTICE_SETS, IndoorPracticeSetId } from '@/lib/putting/drills';
import { cn } from '@/lib/utils';

interface Props {
  onSelect: (category: 'indoor' | 'outdoor') => void;
  onStartIndoorSet: (setId: IndoorPracticeSetId) => void;
}

type PuttingSection = 'tracking' | 'drills';

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

export function PuttingHome({ onSelect, onStartIndoorSet }: Props) {
  const [section, setSection] = useState<PuttingSection>('tracking');

  const sectionButtonClass = (value: PuttingSection) =>
    cn(
      'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
      section === value
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground',
    );

  return (
    <div className="space-y-5">
      <div className="flex justify-end border-b pb-3">
        <div className="inline-flex rounded-md bg-muted/70 p-1">
          <button
            type="button"
            className={sectionButtonClass('tracking')}
            onClick={() => setSection('tracking')}
          >
            <BarChart3 className="h-4 w-4" />
            Tracking
          </button>
          <button
            type="button"
            className={sectionButtonClass('drills')}
            onClick={() => setSection('drills')}
          >
            <ClipboardList className="h-4 w-4" />
            Drills
          </button>
        </div>
      </div>

      {section === 'tracking' ? (
        <PuttingTracking />
      ) : (
        <div className="space-y-5">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <Badge variant="secondary">Practice Builder</Badge>
                <h3 className="mt-2 text-xl font-bold">Drills & Cue Cards</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use this area to start sessions, review the routine, and choose the drill set.
                </p>
              </div>
              <Button onClick={() => onStartIndoorSet('set-a')}>
                <Play className="mr-2 h-4 w-4" />
                Start Session
              </Button>
            </CardContent>
          </Card>

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

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Choose a Putting Set</h3>
            <p className="text-sm text-muted-foreground">Pick the session shape before you start scoring.</p>
          </div>
          <Button variant="outline" onClick={() => onSelect('indoor')}>
            Open Indoor Practice
          </Button>
        </div>

        <div className="grid gap-4 xl:grid-cols-4">
          {INDOOR_PRACTICE_SETS.map(set => (
            <Card
              key={set.id}
              className="cursor-pointer transition hover:border-primary hover:shadow-md"
              onClick={() => onStartIndoorSet(set.id)}
            >
              <CardContent className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge variant={set.id === 'full' ? 'secondary' : 'outline'}>
                      {set.id === 'full' ? 'Test' : set.id.replace('set-', 'Set ').toUpperCase()}
                    </Badge>
                    <h4 className="mt-3 text-lg font-bold leading-tight">{set.name.replace(/^Set [ABC] - /, '')}</h4>
                  </div>
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <ListChecks className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{set.description}</p>
                <div className="space-y-2">
                  {set.drillNames.map((drillName, index) => (
                    <div key={drillName} className="flex gap-2 text-sm">
                      <span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>
                      <span>{drillName}</span>
                    </div>
                  ))}
                </div>
                <Button className="mt-auto w-full" onClick={(event) => {
                  event.stopPropagation();
                  onStartIndoorSet(set.id);
                }}>
                  <Play className="mr-2 h-4 w-4" />
                  Start Set
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <TreePine className="h-12 w-12 text-primary/60" />
            <div>
              <h3 className="text-xl font-bold">Outdoor Putting</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Next section for green-read, pace, and conversion drills outside.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
        </div>
      )}
    </div>
  );
}
