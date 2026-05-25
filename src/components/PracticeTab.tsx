import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PracticeDashboardTab } from '@/components/PracticeDashboardTab';
import { PracticeSummaryTab } from '@/components/PracticeSummaryTab';
import { PracticePlanTab } from '@/components/PracticePlanTab';
import { DrillBankTab } from '@/components/DrillBankTab';
import { PuttingHome } from '@/components/putting/PuttingHome';
import { PuttingIndoor } from '@/components/putting/PuttingIndoor';
import { usePracticeData } from '@/context/PracticeDataContext';
import { parsePracticeConfigKey } from '@/types/practiceClubs';

type PuttingView = 'home' | 'indoor' | 'outdoor';

export function PracticeTab() {
  const [puttingView, setPuttingView] = useState<PuttingView>('home');
  const [fullSwingTab, setFullSwingTab] = useState<string>('summary');
  const { setSelectedClub, setSelectedShotType, setSelectedPower } = usePracticeData();

  const openLog = (configKey: string) => {
    const { club, shotType, power } = parsePracticeConfigKey(configKey);
    setSelectedClub(club);
    setSelectedShotType(shotType);
    setSelectedPower(power);
    setFullSwingTab('logs');
  };

  return (
    <Tabs defaultValue="full-swing" className="w-full">
      <TabsList className="mb-6 w-full justify-start overflow-x-auto sm:w-auto">
        <TabsTrigger value="full-swing" className="shrink-0">Full Swing</TabsTrigger>
        <TabsTrigger value="putting" className="shrink-0">Putting</TabsTrigger>
      </TabsList>

      <TabsContent value="full-swing">
        <Tabs value={fullSwingTab} onValueChange={setFullSwingTab} className="w-full">
          <TabsList className="mb-4 w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="summary" className="shrink-0">Summary</TabsTrigger>
            <TabsTrigger value="logs" className="shrink-0">Practice Logs</TabsTrigger>
            <TabsTrigger value="plan" className="shrink-0">Practice Plan</TabsTrigger>
            <TabsTrigger value="drills" className="shrink-0">Drill Bank</TabsTrigger>
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
        </Tabs>
      </TabsContent>

      <TabsContent value="putting">
        {puttingView === 'home' && <PuttingHome onSelect={setPuttingView} />}
        {puttingView === 'indoor' && <PuttingIndoor onBack={() => setPuttingView('home')} />}
      </TabsContent>
    </Tabs>
  );
}
