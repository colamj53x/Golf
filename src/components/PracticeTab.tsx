import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PracticeDashboardTab } from '@/components/PracticeDashboardTab';
import { PracticeSummaryTab } from '@/components/PracticeSummaryTab';
import { PracticePlanTab } from '@/components/PracticePlanTab';
import { DrillBankTab } from '@/components/DrillBankTab';
import { PuttingHome } from '@/components/putting/PuttingHome';
import { PuttingIndoor } from '@/components/putting/PuttingIndoor';
import { DriverPracticeView } from '@/components/DriverPracticeView';
import { usePracticeData } from '@/context/PracticeDataContext';
import { parsePracticeConfigKey } from '@/types/practiceClubs';
import { IndoorPracticeSetId } from '@/lib/putting/drills';
import { Dumbbell, Layers3, Wand2 } from 'lucide-react';

type PuttingView = 'home' | 'indoor' | 'outdoor';
type FullSwingView = 'home' | 'driver';

const secondaryNavItems = [
  { value: 'summary', label: 'Summary' },
  { value: 'logs', label: 'Logs' },
  { value: 'plan', label: 'Plan' },
  { value: 'drills', label: 'Drill Bank' },
  { value: 'types', label: 'Types' },
];

const fullSwingTiles = [
  {
    title: 'Technique',
    description: 'Setup, movement, and swing feels will live here.',
    icon: Wand2,
  },
  {
    title: 'Club',
    description: 'Driver is the first club ready for your drill instructions.',
    icon: Dumbbell,
    detail: 'Driver',
    view: 'driver' as FullSwingView,
  },
  {
    title: 'Combines',
    description: 'Multi-club practice sets will live here once defined.',
    icon: Layers3,
  },
];

export function PracticeTab() {
  const [fullSwingView, setFullSwingView] = useState<FullSwingView>('home');
  const [fullSwingTab, setFullSwingTab] = useState<string>('summary');
  const [puttingView, setPuttingView] = useState<PuttingView>('home');
  const [puttingSetId, setPuttingSetId] = useState<IndoorPracticeSetId>('set-a');
  const [startPuttingSet, setStartPuttingSet] = useState(false);
  const { setSelectedClub, setSelectedShotType, setSelectedPower } = usePracticeData();

  const openLog = (configKey: string) => {
    const { club, shotType, power } = parsePracticeConfigKey(configKey);
    setSelectedClub(club);
    setSelectedShotType(shotType);
    setSelectedPower(power);
    setFullSwingTab('logs');
  };

  const secondaryNavClass = (value: string) =>
    `h-10 shrink-0 border-b-2 px-1.5 text-sm font-medium transition-colors sm:px-3 ${
      fullSwingTab === value
        ? 'border-primary text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`;

  return (
    <Tabs defaultValue="full-swing" className="w-full space-y-5">
      <h2 className="text-xl font-semibold text-foreground">Practice</h2>

      <TabsContent value="full-swing">
        <div className="mb-5 flex w-full flex-wrap items-end gap-x-5 gap-y-2 border-b">
          <TabsList className="h-9 shrink-0 justify-start overflow-x-auto rounded-md bg-muted/70 p-1">
            <TabsTrigger value="full-swing" className="h-7 shrink-0 px-4">Full Swing</TabsTrigger>
            <TabsTrigger value="putting" className="h-7 shrink-0 px-4">Putting</TabsTrigger>
          </TabsList>
          <div className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto" role="tablist" aria-label="Full swing practice views">
            {secondaryNavItems.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={fullSwingTab === item.value}
                className={secondaryNavClass(item.value)}
                onClick={() => setFullSwingTab(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {fullSwingTab === 'summary' && <PracticeSummaryTab onOpenLog={openLog} />}
        {fullSwingTab === 'logs' && <PracticeDashboardTab />}
        {fullSwingTab === 'plan' && <PracticePlanTab />}
        {fullSwingTab === 'drills' && <DrillBankTab />}
        {fullSwingTab === 'types' && (
          <>
            {fullSwingView === 'home' && (
              <div className="grid gap-4 md:grid-cols-3">
                {fullSwingTiles.map((tile) => {
                  const Icon = tile.icon;
                  return (
                    <Card
                      key={tile.title}
                      className={`h-full transition-colors hover:border-primary/40 ${
                        tile.view ? 'cursor-pointer' : ''
                      }`}
                      onClick={() => {
                        if (tile.view) setFullSwingView(tile.view);
                      }}
                    >
                      <CardHeader className="space-y-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{tile.title}</CardTitle>
                          {tile.detail && (
                            <p className="text-sm font-medium text-primary">{tile.detail}</p>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{tile.description}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            {fullSwingView === 'driver' && (
              <DriverPracticeView onBack={() => setFullSwingView('home')} />
            )}
          </>
        )}
      </TabsContent>

      <TabsContent value="putting">
        <div className="mb-5 flex w-full flex-wrap items-end gap-x-5 gap-y-2 border-b pb-2">
          <TabsList className="h-9 shrink-0 justify-start overflow-x-auto rounded-md bg-muted/70 p-1">
            <TabsTrigger value="full-swing" className="h-7 shrink-0 px-4">Full Swing</TabsTrigger>
            <TabsTrigger value="putting" className="h-7 shrink-0 px-4">Putting</TabsTrigger>
          </TabsList>
        </div>
        {puttingView === 'home' && (
          <PuttingHome
            onSelect={(category) => {
              setStartPuttingSet(false);
              setPuttingView(category);
            }}
            onStartIndoorSet={(setId) => {
              setPuttingSetId(setId);
              setStartPuttingSet(true);
              setPuttingView('indoor');
            }}
          />
        )}
        {puttingView === 'indoor' && (
          <PuttingIndoor
            initialPracticeSetId={puttingSetId}
            startInRun={startPuttingSet}
            onBack={() => {
              setStartPuttingSet(false);
              setPuttingView('home');
            }}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
