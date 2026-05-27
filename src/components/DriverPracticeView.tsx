import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { calculateMetrics, getClubConfigId, processShot } from '@/lib/golfCalculations';
import { ArrowLeft, BarChart3, CheckCircle2, ClipboardList, Footprints, ListChecks, Play, RotateCw, ScanLine, Target } from 'lucide-react';

type DriverRecommendation = {
  headline: string;
  insights: string[];
  technique: string[];
  drills: string[];
};

interface DriverPracticeViewProps {
  onBack: () => void;
}

const routineSteps = [
  {
    title: 'Pick the shot',
    detail: 'Choose the fairway side, trouble side, and the shape you are willing to hit.',
    icon: Target,
  },
  {
    title: 'Choose start line',
    detail: 'Aim at a specific tree, cloud edge, bunker edge, or post. No vague fairway aim.',
    icon: ScanLine,
  },
  {
    title: 'One rehearsal',
    detail: 'Make one slow rehearsal matching the shot shape and finish you want.',
    icon: RotateCw,
  },
  {
    title: 'Commit',
    detail: 'Step in, look once, and swing to the finish without changing the target.',
    icon: CheckCircle2,
  },
];

const setupSteps = [
  {
    title: 'Tee height',
    detail: 'Half the ball above the crown. Tee it high enough to launch, not chop.',
    icon: Target,
  },
  {
    title: 'Ball position',
    detail: 'Inside lead heel with a small spine tilt away from target.',
    icon: Footprints,
  },
  {
    title: 'Width and pressure',
    detail: 'Stable stance, athletic knees, pressure balanced before the takeaway.',
    icon: Footprints,
  },
  {
    title: 'Face first',
    detail: 'Set the face to the start line, then build feet and shoulders around it.',
    icon: ScanLine,
  },
];

const strokeSteps = [
  {
    title: 'Wide takeaway',
    detail: 'Keep the clubhead moving low and wide for the first metre.',
    icon: RotateCw,
  },
  {
    title: 'Turn through',
    detail: 'Let the chest and belt buckle keep rotating through impact.',
    icon: RotateCw,
  },
  {
    title: 'Balanced finish',
    detail: 'Hold the finish until the ball lands. If you cannot hold it, the swing was not yours.',
    icon: CheckCircle2,
  },
];

function formatPct(value: number) {
  return `${Math.round(value)}%`;
}

function buildRecommendation(
  onCourse: ReturnType<typeof calculateMetrics>,
  latestPracticeCount: number,
  latestPracticeScore: number | null,
): DriverRecommendation {
  const insights: string[] = [];
  const technique: string[] = [];
  const drills: string[] = [];

  if (onCourse.shotCount === 0) {
    return {
      headline: 'No Driver tee-shot data is available yet.',
      insights: ['Upload or select Driver tee shots before generating a targeted session.'],
      technique: ['Start with face-to-target setup and a balanced finish checkpoint.'],
      drills: ['Baseline: 10 balls, record start line, curve, strike, and finish balance.'],
    };
  }

  insights.push(`${onCourse.shotCount} Driver tee shots found in on-course data.`);
  insights.push(`On-target rate is ${formatPct(onCourse.onTargetPct)}, with ${formatPct(onCourse.badMissPct)} bad misses and ${Math.round(onCourse.sideVariation)}m side variation.`);
  insights.push(`Average total is ${Math.round(onCourse.avgDistanceHit)}m, with ${formatPct(onCourse.shortPct)} short of stock.`);

  if (latestPracticeCount > 0) {
    const score = latestPracticeScore !== null ? ` and a ${Math.round(latestPracticeScore)}% consistency score` : '';
    insights.push(`Latest Driver practice session has ${latestPracticeCount} tracked shots${score}.`);
  } else {
    insights.push('No recent Driver practice session was found, so this recommendation leans on on-course performance.');
  }

  if (onCourse.badMissPct >= 15) {
    technique.push('Prioritise start-line discipline and a committed finish before chasing speed.');
    drills.push('Fairway gate: 12 balls through a visual 20m gate. Score only start line and playable finish.');
  }

  if (onCourse.sideVariation >= 20 || onCourse.onTargetPct < 50) {
    technique.push('Set the clubface first, then align feet and shoulders around the face.');
    drills.push('Face-first setup: 3 rehearsal setups, then 9 balls holding the finish for three seconds.');
  }

  if (onCourse.shortPct >= 60 || onCourse.avgDistanceHit < 180) {
    technique.push('Check tee height, launch, and full turn through the ball before adding effort.');
    drills.push('Launch ladder: 3 sets of 4 balls at smooth, stock, and assertive speed. Keep balance as the pass/fail.');
  }

  if (technique.length === 0) {
    technique.push('Keep the current driver pattern. The main job is repetition under a clear target routine.');
    drills.push('Maintenance block: 15 balls, full routine every shot, change target every 3 balls.');
  }

  return {
    headline: `Driver session focus: ${technique[0]}`,
    insights,
    technique,
    drills,
  };
}

function StepCard({
  label,
  title,
  icon: Icon,
  steps,
  footer,
}: {
  label: string;
  title: string;
  icon: typeof Target;
  steps: typeof routineSteps;
  footer: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant="outline">{label}</Badge>
            <h3 className="mt-2 text-xl font-bold">{title}</h3>
          </div>
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <div key={step.title} className="flex gap-3 rounded-md border bg-muted/20 p-3">
                <StepIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold">{index + 1}. {step.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
          {footer}
        </p>
      </CardContent>
    </Card>
  );
}

export function DriverPracticeView({ onBack }: DriverPracticeViewProps) {
  const { shots, clubs, distanceToTargetTolerance } = useGolfData();
  const { practiceSessions } = usePracticeData();
  const [recommendation, setRecommendation] = useState<DriverRecommendation | null>(null);

  const driverSummary = useMemo(() => {
    const driverConfig = clubs.find((club) => club.id === 'dr');
    const driverShots = shots
      .filter((shot) => getClubConfigId(shot.club) === 'dr')
      .filter((shot) => shot.startLie.toLowerCase().includes('tee'))
      .map((shot) => processShot(shot, driverConfig, distanceToTargetTolerance));

    const onCourse = calculateMetrics(driverShots, driverConfig);
    const driverPracticeSessions = practiceSessions.filter((session) => session.clubId.startsWith('dr_'));
    const latestPractice = driverPracticeSessions[0] ?? null;

    return {
      onCourse,
      latestPracticeCount: latestPractice?.consistency?.totalShots ?? 0,
      latestPracticeScore: latestPractice?.consistency?.overallScore ?? null,
    };
  }, [clubs, distanceToTargetTolerance, practiceSessions, shots]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-3 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h3 className="mt-2 text-xl font-semibold">Driver Practice</h3>
          <p className="text-sm text-muted-foreground">Routine, setup, stroke, and session focus.</p>
        </div>
        <Button onClick={() => setRecommendation(buildRecommendation(
          driverSummary.onCourse,
          driverSummary.latestPracticeCount,
          driverSummary.latestPracticeScore,
        ))}>
          <BarChart3 className="mr-2 h-4 w-4" />
          Build Session Focus
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <StepCard
          label="Routine"
          title="Pre-Shot Routine"
          icon={ClipboardList}
          steps={routineSteps}
          footer="Pick it. See it. Rehearse it. Commit."
        />
        <StepCard
          label="Setup"
          title="Setup"
          icon={Target}
          steps={setupSteps}
          footer="Face first, then body. Launch window before speed."
        />
        <StepCard
          label="Swing"
          title="Stroke"
          icon={Play}
          steps={strokeSteps}
          footer="Wide, turn, hold the finish."
        />
      </div>

      {recommendation && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant="secondary">Recommended Session</Badge>
                <h3 className="mt-2 text-xl font-bold">{recommendation.headline}</h3>
              </div>
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <ListChecks className="h-5 w-5" />
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <p className="text-sm font-semibold">Performance insight</p>
                {recommendation.insights.map((item) => (
                  <p key={item} className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">{item}</p>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">Technique focus</p>
                {recommendation.technique.map((item) => (
                  <p key={item} className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">{item}</p>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">Drills</p>
                {recommendation.drills.map((item) => (
                  <p key={item} className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">{item}</p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
