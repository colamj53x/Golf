import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PracticeDashboardTab } from '@/components/PracticeDashboardTab';
import { PracticeSummaryTab } from '@/components/PracticeSummaryTab';
import { PracticePlanTab } from '@/components/PracticePlanTab';
import { PuttingHome, PuttingSection } from '@/components/putting/PuttingHome';
import { PuttingIndoor } from '@/components/putting/PuttingIndoor';
import { usePracticeData } from '@/context/PracticeDataContext';
import { parsePracticeConfigKey } from '@/types/practiceClubs';
import { PuttingPracticeSetId } from '@/lib/putting/drills';

type PuttingView = 'home' | 'indoor';

const secondaryNavItems = [
  { value: 'summary', label: 'Next Session' },
  { value: 'logs', label: 'Logs' },
  { value: 'plan', label: 'Plan' },
];

const puttingNavItems: Array<{ value: PuttingSection; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'sets', label: 'Practice Sets' },
  { value: 'warmup', label: 'Warm-Up' },
  { value: 'drills', label: 'Drill Library' },
];

export function PracticeTab() {
  const [practiceMode, setPracticeMode] = useState<'full-swing' | 'putting'>('full-swing');
  const [fullSwingTab, setFullSwingTab] = useState<string>('summary');
  const [puttingSection, setPuttingSection] = useState<PuttingSection>('overview');
  const [puttingView, setPuttingView] = useState<PuttingView>('home');
  const [puttingSetId, setPuttingSetId] = useState<PuttingPracticeSetId>('set-a');
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
        {fullSwingTab === 'summary' && (
          <PracticeSummaryTab
            onOpenLog={openLog}
          />
        )}
        {fullSwingTab === 'logs' && <PracticeDashboardTab />}
        {fullSwingTab === 'plan' && <PracticePlanTab />}
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
