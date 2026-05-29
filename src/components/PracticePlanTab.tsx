import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Target, Dumbbell, Gauge, Trash2, TrendingUp, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { getConfigDisplayName } from '@/types/practiceClubs';
import { getDrillsForConfig, ScorableDrill, BaselineDrill, SESSION_BALL_SPLIT } from '@/lib/practiceDrillsLibrary';
import { PracticeSession } from '@/types/practice';

interface DrillScoreRow {
  id: string;
  drill_id: string;
  drill_kind: 'scorable' | 'baseline';
  config_key: string;
  score: number;
  max_score: number;
  balls: number | null;
  score_date: string;
  notes: string | null;
}

type PracticeGroupId = 'driver' | 'hybrids' | 'approach' | 'wedges' | 'short';

const PRACTICE_GROUPS: Array<{
  id: PracticeGroupId;
  title: string;
  description: string;
  configKeys: string[];
  enabled: boolean;
}> = [
  {
    id: 'driver',
    title: 'Driver',
    description: 'Tee shots: distance, start line, playable misses.',
    configKeys: ['dr_full_full'],
    enabled: true,
  },
  {
    id: 'hybrids',
    title: 'Hybrids / Woods',
    description: 'Long clubs: playable launch, carry windows, recovery from distance.',
    configKeys: ['5w_full_full', '4h_full_full', '5h_full_full'],
    enabled: false,
  },
  {
    id: 'approach',
    title: 'Approach Irons',
    description: '6i-9i full shots: carry control, start line, green-hitting patterns.',
    configKeys: ['6i_full_full', '7i_full_full', '8i_full_full', '9i_full_full'],
    enabled: false,
  },
  {
    id: 'wedges',
    title: 'Wedges',
    description: 'Pitch and wedge distance control: carry windows and launch consistency.',
    configKeys: [
      'pw_full_full', 'pw_pitch_730pm', 'pw_pitch_9pm', 'pw_pitch_10pm',
      'gw_pitch_730pm', 'gw_pitch_9pm', 'gw_pitch_10pm',
      'sw_pitch_730pm', 'sw_pitch_9pm', 'sw_pitch_10pm',
    ],
    enabled: false,
  },
  {
    id: 'short',
    title: 'Chips / Bumps',
    description: 'Short shots: chips, bumps, punches, and recovery control.',
    configKeys: [
      '6i_punch_full', '7i_punch_full',
      '8i_bump_730pm', '8i_bump_9pm',
      '9i_bump_730pm', '9i_bump_9pm',
      'pw_chip_730pm', 'pw_chip_9pm',
      'gw_chip_730pm', 'gw_chip_9pm',
    ],
    enabled: false,
  },
];

const DRIVER_CONFIG_KEY = 'dr_full_full';

interface OutcomeSummary {
  scoredSessions: number;
  latestDate: Date | null;
  latestScore: number | null;
  currentForm: number | null;
  bestScore: number | null;
  distanceForm: number | null;
  dispersionForm: number | null;
  strikeForm: number | null;
  focusLabel: string;
  focusTags: string[];
  trend: 'up' | 'down' | 'same' | 'none';
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getLevel(score: number | null): { label: string; className: string; barClassName: string } {
  if (score === null) {
    return {
      label: 'No data',
      className: 'border-border bg-muted/20 text-muted-foreground',
      barClassName: 'bg-muted',
    };
  }
  if (score >= 80) {
    return {
      label: 'Strong',
      className: 'border-green-500/40 bg-green-500/10 text-green-700',
      barClassName: 'bg-green-500',
    };
  }
  if (score >= 60) {
    return {
      label: 'Developing',
      className: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
      barClassName: 'bg-amber-500',
    };
  }
  return {
    label: 'Priority',
    className: 'border-red-500/40 bg-red-500/10 text-red-700',
    barClassName: 'bg-red-500',
  };
}

function buildOutcomeSummary(sessions: PracticeSession[]): OutcomeSummary {
  const scored = sessions.filter((session) => session.consistency);
  const recent10 = scored.slice(0, 10);
  const latest = scored[0] ?? sessions[0] ?? null;
  const latestScore = latest?.consistency?.overallScore ?? null;
  const currentForm = average(recent10.map((session) => session.consistency!.overallScore));
  const bestScore = scored.length ? Math.max(...scored.map((session) => session.consistency!.overallScore)) : null;
  const distanceForm = average(recent10.map((session) => session.consistency!.distancePct));
  const dispersionForm = average(recent10.map((session) => session.consistency!.lateralPct));
  const strikeForm = average(recent10.map((session) => session.consistency!.bestPct));

  const areas = [
    {
      label: 'Distance control',
      score: distanceForm,
      tags: ['carry', 'total_distance', 'strike'],
    },
    {
      label: 'Start line / dispersion',
      score: dispersionForm,
      tags: ['start_line', 'offline', 'curve'],
    },
    {
      label: 'Strike quality',
      score: strikeForm,
      tags: ['strike', 'tempo', 'smash_factor'],
    },
  ].sort((a, b) => (a.score ?? -1) - (b.score ?? -1));

  const focus = areas[0];
  const recent5 = scored.slice(0, 5);
  const previous5 = scored.slice(5, 10);
  const recent5Avg = average(recent5.map((session) => session.consistency!.overallScore));
  const previous5Avg = average(previous5.map((session) => session.consistency!.overallScore));
  const trend = (() => {
    if (recent5Avg === null || previous5Avg === null) return 'none';
    const diff = recent5Avg - previous5Avg;
    if (diff >= 5) return 'up';
    if (diff <= -5) return 'down';
    return 'same';
  })();

  return {
    scoredSessions: scored.length,
    latestDate: latest?.date ?? null,
    latestScore,
    currentForm,
    bestScore,
    distanceForm,
    dispersionForm,
    strikeForm,
    focusLabel: focus.score === null || focus.score >= 75 ? 'Maintain driver baseline' : focus.label,
    focusTags: focus.tags,
    trend,
  };
}

function drillMatchesWeakness(
  drill: { fixes?: string[]; metricsAddressed?: string[] },
  tags: string[],
): boolean {
  const fixes = drill.fixes ?? [];
  const metrics = (drill.metricsAddressed ?? []).map((metric) => metric.toLowerCase());
  return tags.some((tag) => {
    if (fixes.some((fix) => tag.includes(fix) || fix.includes(tag))) return true;
    if (tag === 'start_line' || tag === 'offline' || tag === 'curve') {
      return metrics.some((metric) =>
        metric.includes('start') || metric.includes('lateral') || metric.includes('curve') || metric.includes('fairway') || metric.includes('face'),
      );
    }
    if (tag === 'carry' || tag === 'total_distance') {
      return metrics.some((metric) => metric.includes('carry') || metric.includes('distance'));
    }
    if (tag === 'strike' || tag === 'smash_factor') {
      return metrics.some((metric) => metric.includes('strike') || metric.includes('smash'));
    }
    if (tag === 'tempo') {
      return metrics.some((metric) => metric.includes('tempo'));
    }
    return false;
  });
}

export function PracticePlanTab() {
  const { user } = useAuth();
  const {
    practiceSessions,
  } = usePracticeData();
  const [selectedGroupId, setSelectedGroupId] = useState<PracticeGroupId>('driver');

  const selectedGroup = PRACTICE_GROUPS.find((group) => group.id === selectedGroupId) ?? PRACTICE_GROUPS[0];
  const activeConfigKey = selectedGroup.id === 'driver' ? DRIVER_CONFIG_KEY : selectedGroup.configKeys[0];
  const drills = selectedGroup.enabled ? getDrillsForConfig(activeConfigKey) : null;
  const displayName = useMemo(() => {
    try { return getConfigDisplayName(activeConfigKey); } catch { return selectedGroup.title; }
  }, [activeConfigKey, selectedGroup.title]);

  const sessionsByGroup = useMemo(() => {
    const sorted = [...practiceSessions].sort((a, b) => b.date.getTime() - a.date.getTime());
    return Object.fromEntries(
      PRACTICE_GROUPS.map((group) => [
        group.id,
        sorted.filter((session) => group.configKeys.includes(session.clubId)),
      ]),
    ) as Record<PracticeGroupId, PracticeSession[]>;
  }, [practiceSessions]);

  const outcomeByGroup = useMemo(() => {
    return Object.fromEntries(
      PRACTICE_GROUPS.map((group) => [group.id, buildOutcomeSummary(sessionsByGroup[group.id] ?? [])]),
    ) as Record<PracticeGroupId, OutcomeSummary>;
  }, [sessionsByGroup]);

  const outcome = outcomeByGroup[selectedGroupId];

  const { recommendedTechniques, recommendedScorable } = useMemo(() => {
    const empty = {
      recommendedTechniques: [] as Array<{ drill: NonNullable<typeof drills>['technique'][number]; basedOn: string }>,
      recommendedScorable: [] as string[],
    };
    if (!drills) return empty;
    const tags = outcome.focusTags;

    const recTech: Array<{ drill: NonNullable<typeof drills>['technique'][number]; basedOn: string }> = [];
    const usedIds = new Set<string>();
    for (const drill of drills.technique) {
      if (recTech.length >= 2) break;
      if (drillMatchesWeakness(drill, tags)) {
        recTech.push({ drill, basedOn: outcome.focusLabel });
        usedIds.add(drill.id);
      }
    }
    for (const drill of drills.technique) {
      if (recTech.length >= 2) break;
      if (!usedIds.has(drill.id)) {
        recTech.push({ drill, basedOn: outcome.focusLabel });
        usedIds.add(drill.id);
      }
    }

    const recScorable = drills.scorable
      .filter((drill) => drillMatchesWeakness(drill, tags))
      .map((drill) => drill.id);

    return { recommendedTechniques: recTech, recommendedScorable: recScorable };
  }, [drills, outcome.focusLabel, outcome.focusTags]);

  // Drill scores for this config
  const [scores, setScores] = useState<DrillScoreRow[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);

  useEffect(() => {
    if (!user || !selectedGroup.enabled) { setScores([]); return; }
    let cancelled = false;
    setLoadingScores(true);
    supabase
      .from('practice_drill_scores')
      .select('*')
      .eq('user_id', user.id)
      .eq('config_key', activeConfigKey)
      .order('score_date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error('Failed to load drill scores');
          setScores([]);
        } else {
          setScores((data ?? []) as DrillScoreRow[]);
        }
        setLoadingScores(false);
      });
    return () => { cancelled = true; };
  }, [user, activeConfigKey, selectedGroup.enabled]);

  const addScore = async (
    drill_id: string,
    drill_kind: 'scorable' | 'baseline',
    score: number,
    max_score: number,
    balls: number | null,
    score_date: string,
    notes: string | null,
  ) => {
    if (!user) { toast.error('Sign in to save scores'); return; }
    if (!selectedGroup.enabled) { toast.error('This practice group is not live yet'); return; }
    const { data, error } = await supabase
      .from('practice_drill_scores')
      .insert({
        user_id: user.id,
        drill_id,
        drill_kind,
        config_key: activeConfigKey,
        score,
        max_score,
        balls,
        score_date,
        notes,
      })
      .select()
      .single();
    if (error) { toast.error('Failed to save score'); return; }
    setScores(prev => [data as DrillScoreRow, ...prev]);
    toast.success('Score saved');
  };

  const deleteScore = async (id: string) => {
    if (!user) { toast.error('Sign in to delete scores'); return; }
    const { error } = await supabase
      .from('practice_drill_scores')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) { toast.error('Delete failed'); return; }
    setScores(prev => prev.filter(s => s.id !== id));
  };

  // Aggregate stats per drill
  const statsFor = (drillId: string) => {
    const rows = scores.filter(s => s.drill_id === drillId);
    if (rows.length === 0) return null;
    const pcts = rows.map(r => (r.max_score ? (r.score / r.max_score) * 100 : 0));
    const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    const best = Math.max(...pcts);
    const last = rows[0]; // already sorted desc by date
    return { count: rows.length, avgPct: Math.round(avg), bestPct: Math.round(best), last };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Practice Plan</CardTitle>
          <CardDescription>
            Group similar shots, read the practice outcome from Logs, then choose technique, scoring, and 6-shot baseline work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {PRACTICE_GROUPS.map((group) => (
              <PracticeGroupCard
                key={group.id}
                group={group}
                outcome={outcomeByGroup[group.id]}
                selected={group.id === selectedGroupId}
                onSelect={() => setSelectedGroupId(group.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {!drills ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <div className="mx-auto max-w-xl space-y-2">
              <p className="text-base font-semibold text-foreground">{selectedGroup.title} plan is next.</p>
              <p>
                The grouping and log summary are in place. Driver is live first so we can get the structure right, then copy the same pattern into this group.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <DriverOutcomePanel outcome={outcome} displayName={displayName} />

          <Card className="bg-muted/30">
            <CardContent className="py-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium">Driver session split:</span>
              <Badge variant="outline" className="gap-1"><Dumbbell className="h-3 w-3" /> {SESSION_BALL_SPLIT.technique} technique</Badge>
              <Badge variant="outline" className="gap-1"><Target className="h-3 w-3" /> {SESSION_BALL_SPLIT.scorable} scorable</Badge>
              <Badge variant="outline" className="gap-1"><Gauge className="h-3 w-3" /> {SESSION_BALL_SPLIT.baseline} baseline</Badge>
              <span className="text-muted-foreground ml-auto">
                = {SESSION_BALL_SPLIT.technique + SESSION_BALL_SPLIT.scorable + SESSION_BALL_SPLIT.baseline} balls total
              </span>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.1fr_0.95fr]">
            <section className="space-y-3">
              <SectionHeader
                icon={<Dumbbell className="h-4 w-4" />}
                title="Technique Fixes"
                description={`${SESSION_BALL_SPLIT.technique} balls. Pick one feel and stay with it.`}
              />
              {(recommendedTechniques.length > 0
                ? recommendedTechniques.map((item) => item.drill)
                : drills.technique.slice(0, 2)
              ).map((drill) => {
                const rec = recommendedTechniques.find((item) => item.drill.id === drill.id);
                return (
                  <Card key={drill.id} className="border-amber-500/50 bg-amber-500/5">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <CardTitle className="text-base">{drill.name}</CardTitle>
                        <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                          {rec ? `Fix: ${rec.basedOn}` : 'Technique'}
                        </Badge>
                      </div>
                      <CardDescription>{drill.focus}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div><span className="font-medium">Setup:</span> <span className="text-muted-foreground">{drill.setup}</span></div>
                      <div><span className="font-medium">Cue:</span> <span className="text-muted-foreground">{drill.cue}</span></div>
                    </CardContent>
                  </Card>
                );
              })}
            </section>

            <section className="space-y-3">
              <SectionHeader
                icon={<Target className="h-4 w-4" />}
                title="Scorable Reinforcement"
                description={`${SESSION_BALL_SPLIT.scorable} balls. Score it so the fix shows up in the data.`}
              />
              {[...drills.scorable]
                .sort((a, b) => {
                  const ar = recommendedScorable.includes(a.id) ? 0 : 1;
                  const br = recommendedScorable.includes(b.id) ? 0 : 1;
                  return ar - br;
                })
                .slice(0, 3)
                .map((drill) => (
                  <ScorableDrillCard
                    key={drill.id}
                    drill={drill}
                    recommended={recommendedScorable.includes(drill.id)}
                    history={scores.filter((score) => score.drill_id === drill.id)}
                    stats={statsFor(drill.id)}
                    onSave={(score, dateStr, notes) =>
                      addScore(drill.id, 'scorable', score, drill.maxScore, drill.balls, dateStr, notes)
                    }
                    onDelete={deleteScore}
                    loading={loadingScores}
                  />
                ))}
            </section>

            <section className="space-y-3">
              <SectionHeader
                icon={<Gauge className="h-4 w-4" />}
                title="Baseline Mapping"
                description="Always 6 balls. A quick map of what driver is doing today."
              />
              {drills.baseline.map((drill) => (
                <BaselineDrillCard
                  key={drill.id}
                  drill={drill}
                  history={scores.filter((score) => score.drill_id === drill.id)}
                  stats={statsFor(drill.id)}
                  onSave={(score, dateStr, notes) =>
                    addScore(drill.id, 'baseline', score, SESSION_BALL_SPLIT.baseline, SESSION_BALL_SPLIT.baseline, dateStr, notes)
                  }
                  onDelete={deleteScore}
                  loading={loadingScores}
                />
              ))}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

// =====================================================
// Sub-components
// =====================================================

function PracticeGroupCard({
  group,
  outcome,
  selected,
  onSelect,
}: {
  group: typeof PRACTICE_GROUPS[number];
  outcome: OutcomeSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const level = getLevel(outcome.currentForm);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        'rounded-lg border p-4 text-left transition-colors ' +
        (selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card hover:bg-muted/30')
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">{group.title}</div>
          <div className="mt-1 text-xs leading-snug text-muted-foreground">{group.description}</div>
        </div>
        {!group.enabled && <Badge variant="outline">Next</Badge>}
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-bold text-foreground">
            {outcome.currentForm === null ? 'No data' : `${outcome.currentForm}%`}
          </div>
          <div className="text-xs text-muted-foreground">
            {outcome.scoredSessions ? `${outcome.scoredSessions} scored` : 'Not tracked yet'}
          </div>
        </div>
        <Badge variant="outline" className={level.className}>
          {level.label}
        </Badge>
      </div>
    </button>
  );
}

function DriverOutcomePanel({
  outcome,
  displayName,
}: {
  outcome: OutcomeSummary;
  displayName: string;
}) {
  const level = getLevel(outcome.currentForm);
  const trendText = {
    up: 'Getting better',
    down: 'Needs attention',
    same: 'Holding steady',
    none: 'Trend pending',
  }[outcome.trend];

  return (
    <Card className={level.className}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5" />
              Driver Practice Outcome
            </CardTitle>
            <CardDescription className="mt-1">
              {displayName} from the practice logs
              {outcome.latestDate ? ` • Last: ${format(outcome.latestDate, 'dd MMM yyyy')}` : ''}
            </CardDescription>
          </div>
          <Badge variant="outline" className={level.className}>
            {level.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
          <OutcomeStat label="Current Form" value={outcome.currentForm === null ? 'No data' : `${outcome.currentForm}%`} note="Last 10 scored sessions" strong />
          <OutcomeStat label="Latest" value={outcome.latestScore === null ? 'Not scored' : `${outcome.latestScore}%`} />
          <OutcomeStat label="Best" value={outcome.bestScore === null ? '-' : `${outcome.bestScore}%`} />
          <OutcomeStat label="Sessions" value={String(outcome.scoredSessions)} />
          <OutcomeStat label="Trend" value={trendText} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <OutcomeArea label="Distance control" score={outcome.distanceForm} />
          <OutcomeArea label="Start line / dispersion" score={outcome.dispersionForm} />
          <OutcomeArea label="Strike quality" score={outcome.strikeForm} />
        </div>

        <div className="rounded-md border bg-background/70 p-3 text-sm">
          <span className="font-medium">What to focus on: </span>
          <span className="text-muted-foreground">{outcome.focusLabel}</span>
          <span className="mx-2 text-muted-foreground">•</span>
          <span className="font-medium">Watch next: </span>
          <span className="text-muted-foreground">
            the scorable driver result and the 6-shot baseline. If both move, the technique fix is real.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function OutcomeStat({
  label,
  value,
  note,
  strong,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-md border bg-background/70 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={(strong ? 'text-3xl' : 'text-lg') + ' mt-1 font-bold text-foreground'}>{value}</div>
      {note && <div className="mt-1 text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}

function OutcomeArea({ label, score }: { label: string; score: number | null }) {
  const level = getLevel(score);
  return (
    <div className="rounded-md border bg-background/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-sm font-bold">{score === null ? '-' : `${score}%`}</div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-muted">
        <div
          className={`h-2 rounded-full ${level.barClassName}`}
          style={{ width: `${Math.max(0, Math.min(score ?? 0, 100))}%` }}
        />
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        {icon}
        {title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

interface CommonCardProps {
  history: DrillScoreRow[];
  stats: { count: number; avgPct: number; bestPct: number; last: DrillScoreRow } | null;
  onSave: (score: number, dateStr: string, notes: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  loading: boolean;
}

function ScorableDrillCard({
  drill, recommended, history, stats, onSave, onDelete, loading,
}: CommonCardProps & { drill: ScorableDrill; recommended?: boolean }) {
  const [score, setScore] = useState('');
  const [dateStr, setDateStr] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const save = async () => {
    const s = parseFloat(score);
    if (Number.isNaN(s)) { toast.error('Enter a score'); return; }
    if (s < 0 || s > drill.maxScore) { toast.error(`Score must be 0–${drill.maxScore}`); return; }
    setSaving(true);
    await onSave(s, dateStr, notes.trim() || null);
    setSaving(false);
    setScore('');
    setNotes('');
  };

  return (
    <Card className={recommended ? 'border-amber-500/60 ring-1 ring-amber-500/30' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            {drill.name}
            {recommended && <Badge className="bg-amber-500 text-white hover:bg-amber-500">Recommended</Badge>}
          </CardTitle>
          <div className="flex gap-2 items-center text-xs">
            <Badge variant="outline">{drill.balls} balls</Badge>
            <Badge variant="outline">/{drill.maxScore}</Badge>
            <Badge variant="secondary">Pass: {drill.pass}</Badge>
          </div>
        </div>
        <CardDescription>{drill.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div><span className="font-medium">Scoring:</span> <span className="text-muted-foreground">{drill.scoring}</span></div>

        <StatsRow stats={stats} loading={loading} />

        <div className="flex flex-wrap items-end gap-2 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Score</label>
            <Input
              type="number" min={0} max={drill.maxScore} step="0.5"
              value={score} onChange={e => setScore(e.target.value)}
              placeholder={`0–${drill.maxScore}`}
              className="w-24"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <Input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1 flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="conditions, swing thought…" />
          </div>
          <Button onClick={save} disabled={saving}>Save round</Button>
        </div>

        <HistoryBlock
          history={history}
          show={showHistory}
          onToggle={() => setShowHistory(s => !s)}
          onDelete={onDelete}
        />
      </CardContent>
    </Card>
  );
}

function BaselineDrillCard({
  drill, history, stats, onSave, onDelete, loading,
}: CommonCardProps & { drill: BaselineDrill }) {
  const BALL_COUNT = SESSION_BALL_SPLIT.baseline;
  const makeEmpty = () => Array.from({ length: BALL_COUNT }, () => false);
  const [balls, setBalls] = useState<boolean[]>(makeEmpty);
  const [dateStr, setDateStr] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const score = balls.filter(Boolean).length;

  const save = async () => {
    setSaving(true);
    await onSave(score, dateStr, notes.trim() || null);
    setSaving(false);
    setBalls(makeEmpty());
    setNotes('');
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">{drill.name}</CardTitle>
          <Badge variant="outline">{BALL_COUNT} balls</Badge>
        </div>
        <CardDescription>{drill.what}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div><span className="font-medium">Setup:</span> <span className="text-muted-foreground">{drill.setup}</span></div>
        <div><span className="font-medium">Scoring:</span> <span className="text-muted-foreground">{drill.scoring}</span></div>

        <StatsRow stats={stats} loading={loading} />

        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground mr-1">Mark each ball:</span>
            {balls.map((hit, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setBalls(prev => prev.map((b, idx) => idx === i ? !b : b))}
                className={
                  'h-9 w-9 rounded-full border-2 text-sm font-semibold transition-colors ' +
                  (hit
                    ? 'bg-green-500 border-green-600 text-white'
                    : 'bg-muted/40 border-muted-foreground/30 text-muted-foreground hover:bg-muted')
                }
                aria-label={`Ball ${i + 1} ${hit ? 'hit' : 'miss'}`}
              >
                {i + 1}
              </button>
            ))}
            <span className="ml-2 text-sm font-medium">= {score}/{BALL_COUNT}</span>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Date</label>
              <Input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="wind, lie, club setup…" />
            </div>
            <Button onClick={save} disabled={saving}>Save baseline</Button>
          </div>
        </div>

        <HistoryBlock
          history={history}
          show={showHistory}
          onToggle={() => setShowHistory(s => !s)}
          onDelete={onDelete}
        />
      </CardContent>
    </Card>
  );
}

function StatsRow({
  stats, loading,
}: { stats: { count: number; avgPct: number; bestPct: number; last: DrillScoreRow } | null; loading: boolean }) {
  if (loading) return <p className="text-xs text-muted-foreground">Loading history…</p>;
  if (!stats) return <p className="text-xs text-muted-foreground">No attempts yet — log your first round to start tracking.</p>;
  const fmtPct = (n: number) => `${n}%`;
  const toneFor = (pct: number) =>
    pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-md bg-muted/40 p-2">
      <Stat label="Attempts" value={String(stats.count)} />
      <Stat label="Last" value={`${stats.last.score}/${stats.last.max_score}`} tone={toneFor((stats.last.score / stats.last.max_score) * 100)} />
      <Stat label="Avg" value={fmtPct(stats.avgPct)} tone={toneFor(stats.avgPct)} />
      <Stat label="Best" value={fmtPct(stats.bestPct)} tone={toneFor(stats.bestPct)} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={'text-base font-semibold ' + (tone ?? 'text-foreground')}>{value}</div>
    </div>
  );
}

function HistoryBlock({
  history, show, onToggle, onDelete,
}: {
  history: DrillScoreRow[];
  show: boolean;
  onToggle: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  if (history.length === 0) return null;
  return (
    <div className="border-t pt-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <TrendingUp className="h-3 w-3" />
        {show ? 'Hide' : 'Show'} score history ({history.length})
      </button>
      {show && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-1 pr-2">Date</th>
                <th className="py-1 pr-2">Score</th>
                <th className="py-1 pr-2">%</th>
                <th className="py-1 pr-2">Notes</th>
                <th className="py-1 pr-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {history.map(h => {
                const pct = h.max_score ? Math.round((h.score / h.max_score) * 100) : 0;
                return (
                  <tr key={h.id} className="border-t border-border/50">
                    <td className="py-1 pr-2">{format(new Date(h.score_date), 'dd MMM yyyy')}</td>
                    <td className="py-1 pr-2 font-medium">{h.score}/{h.max_score}</td>
                    <td className="py-1 pr-2">{pct}%</td>
                    <td className="py-1 pr-2 text-muted-foreground">{h.notes ?? '—'}</td>
                    <td className="py-1 pr-2 text-right">
                      <Button
                        size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => onDelete(h.id)}
                        aria-label="Delete score"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
