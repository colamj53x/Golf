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

  return (
    <Tabs defaultValue="full-swing" className="w-full space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Practice</h2>
        </div>
        <TabsList className="h-9 w-full justify-start overflow-x-auto rounded-md bg-muted/70 p-1 sm:w-auto">
          <TabsTrigger value="full-swing" className="h-7 shrink-0 px-4">Full Swing</TabsTrigger>
          <TabsTrigger value="putting" className="h-7 shrink-0 px-4">Putting</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="full-swing">
        <Tabs value={fullSwingTab} onValueChange={setFullSwingTab} className="w-full">
          <TabsList className="mb-5 h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-0 text-muted-foreground">
            <TabsTrigger
              value="summary"
              className="h-10 shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-1.5 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:px-3"
            >
              Summary
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="h-10 shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-1.5 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:px-3"
            >
              Logs
            </TabsTrigger>
            <TabsTrigger
              value="plan"
              className="h-10 shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-1.5 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:px-3"
            >
              Plan
            </TabsTrigger>
            <TabsTrigger
              value="drills"
              className="h-10 shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-1.5 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:px-3"
            >
              Drill Bank
            </TabsTrigger>
            <TabsTrigger
              value="types"
              className="h-10 shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-1.5 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:px-3"
            >
              Types
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <PracticeSummaryTab onOpenLog={openLog} />
          </TabsContent>
          <TabsContent value="logs">
            <PracticeDashboardTab />
          </TabsContent>
          <TabsContent value="plan">
            <PracticePlanTab />
          </TabsContent>
          <TabsContent value="drills">
            <DrillBankTab />
          </TabsContent>
          <TabsContent value="types">
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
          </TabsContent>
        </Tabs>
      </TabsContent>

      <TabsContent value="putting">
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
