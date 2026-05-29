import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PracticeDashboardTab } from '@/components/PracticeDashboardTab';
import { PracticeSummaryTab } from '@/components/PracticeSummaryTab';
import { PracticePlanTab } from '@/components/PracticePlanTab';
import { PuttingHome, PuttingSection } from '@/components/putting/PuttingHome';
import { PuttingIndoor } from '@/components/putting/PuttingIndoor';
import { DriverPracticeView } from '@/components/DriverPracticeView';
import { usePracticeData } from '@/context/PracticeDataContext';
import { parsePracticeConfigKey } from '@/types/practiceClubs';
import { IndoorPracticeSetId } from '@/lib/putting/drills';
import { Dumbbell, Layers3, Wand2 } from 'lucide-react';

type PuttingView = 'home' | 'indoor';
type FullSwingView = 'home' | 'driver';

const secondaryNavItems = [
  { value: 'summary', label: 'Summary' },
  { value: 'logs', label: 'Logs' },
  { value: 'plan', label: 'Plan' },
  { value: 'types', label: 'Shot Types' },
];

const puttingNavItems: Array<{ value: PuttingSection; label: string }> = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'drills', label: 'Drills' },
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
    title: 'Combined Sets',
    description: 'Multi-club practice sets will live here once defined.',
    icon: Layers3,
  },
];

export function PracticeTab() {
  const [practiceMode, setPracticeMode] = useState<'full-swing' | 'putting'>('full-swing');
  const [fullSwingView, setFullSwingView] = useState<FullSwingView>('home');
  const [fullSwingTab, setFullSwingTab] = useState<string>('summary');
  const [puttingSection, setPuttingSection] = useState<PuttingSection>('dashboard');
  const [puttingView, setPuttingView] = useState<PuttingView>('home');
  const [puttingSetId, setPuttingSetId] = useState<IndoorPracticeSetId>('set-a');
  const { setSelectedClub, setSelectedShotType, setSelectedPower } = usePracticeData();

  const openLog = (configKey: string) => {
    const { club, shotType, power } = parsePracticeConfigKey(configKey);
    setSelectedClub(club);
    setSelectedShotType(shotType);
    setSelectedPower(power);
    setFullSwingTab('logs');
  };

  const secondaryNavClass = (active: boolean) =>
    `h-8 shrink-0 border-b-2 px-2 text-sm font-medium transition-colors sm:px-3 ${
      active
        ? 'border-primary text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`;

  return (
    <Tabs
      value={practiceMode}
      onValueChange={(value) => setPracticeMode(value as typeof practiceMode)}
      className="w-full space-y-3"
    >
      <div className="border-b pb-2">
        <TabsList className="h-9 shrink-0 justify-start overflow-x-auto rounded-md bg-muted/70 p-1">
          <TabsTrigger value="full-swing" className="h-7 shrink-0 px-4">Full Swing</TabsTrigger>
          <TabsTrigger value="putting" className="h-7 shrink-0 px-4">Putting</TabsTrigger>
        </TabsList>
        <div className="mt-2 flex min-w-0 gap-1 overflow-x-auto" role="tablist" aria-label={`${practiceMode === 'full-swing' ? 'Full swing' : 'Putting'} practice views`}>
        {practiceMode === 'full-swing' && (
          secondaryNavItems.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={fullSwingTab === item.value}
              className={secondaryNavClass(fullSwingTab === item.value)}
              onClick={() => setFullSwingTab(item.value)}
            >
              {item.label}
            </button>
          ))
        )}
        {practiceMode === 'putting' && (
          puttingNavItems.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={puttingSection === item.value}
              className={secondaryNavClass(puttingSection === item.value)}
              onClick={() => {
                setPuttingSection(item.value);
                setPuttingView('home');
              }}
            >
              {item.label}
            </button>
          ))
        )}
        </div>
      </div>

      <TabsContent value="full-swing" className="mt-0">
        {fullSwingTab === 'summary' && <PracticeSummaryTab onOpenLog={openLog} />}
        {fullSwingTab === 'logs' && <PracticeDashboardTab />}
        {fullSwingTab === 'plan' && <PracticePlanTab />}
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

      <TabsContent value="putting" className="mt-0">
        {puttingView === 'home' && (
          <PuttingHome
            section={puttingSection}
            onStartIndoorSet={(setId) => {
              setPuttingSetId(setId);
              setPuttingView('indoor');
            }}
          />
        )}
        {puttingView === 'indoor' && (
          <PuttingIndoor
            initialPracticeSetId={puttingSetId}
            onBack={() => {
              setPuttingView('home');
            }}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
