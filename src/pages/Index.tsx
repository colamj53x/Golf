import { Suspense, lazy } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Crosshair, Goal, LogOut, Settings as SettingsIcon, Target } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DashboardTab = lazy(async () => ({ default: (await import('@/components/DashboardTab')).DashboardTab }));
const AnalysisOverview = lazy(async () => ({ default: (await import('@/components/analysis/AnalysisOverview')).AnalysisOverview }));
const SettingsTab = lazy(async () => ({ default: (await import('@/components/SettingsTab')).SettingsTab }));
const ShotProfilesCard = lazy(async () => ({ default: (await import('@/components/SettingsTab')).ShotProfilesCard }));
const UploadTab = lazy(async () => ({ default: (await import('@/components/UploadTab')).UploadTab }));
const PracticeTab = lazy(async () => ({ default: (await import('@/components/PracticeTab')).PracticeTab }));
const ClubSelectorTab = lazy(async () => ({ default: (await import('@/components/ClubSelectorTab')).ClubSelectorTab }));
const ClubGappingTab = lazy(async () => ({ default: (await import('@/components/ClubGappingTab')).ClubGappingTab }));
const OnCourseCuesTab = lazy(async () => ({ default: (await import('@/components/OnCourseCuesTab')).OnCourseCuesTab }));
const ReportsTab = lazy(async () => ({ default: (await import('@/components/reports/ReportsTab')).ReportsTab }));
const LibraryTab = lazy(async () => ({ default: (await import('@/components/LibraryTab')).LibraryTab }));
const MoreToolsTab = lazy(async () => ({ default: (await import('@/components/MoreToolsTab')).MoreToolsTab }));
const PlayingPartnersTab = lazy(async () => ({ default: (await import('@/components/PlayingPartnersTab')).PlayingPartnersTab }));
const JournalTab = lazy(async () => ({ default: (await import('@/components/JournalTab')).JournalTab }));

const mainTabs = ['play', 'review', 'practice', 'settings'] as const;
const playTabs = ['shot-picker', 'short-game-matrix', 'club-gapping', 'cues'] as const;
const reviewTabs = ['today', 'rounds', 'journal', 'advanced'] as const;
const settingsTabs = ['partners', 'shot-profiles', 'upload', 'library', 'tools', 'preferences'] as const;
type MainTab = typeof mainTabs[number];

const TabLoader = () => <div className="space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /><Skeleton className="h-32 w-full" /></div>;
const isIn = <T extends readonly string[]>(items: T, value: string): value is T[number] => items.includes(value as T[number]);
const path = (tab: MainTab, ...segments: string[]) => `/${[tab, ...segments].filter(Boolean).join('/')}`;
const mainPath = (tab: MainTab) => {
  if (tab === 'play') return path('play', 'shot-picker');
  if (tab === 'review') return path('review', 'today');
  if (tab === 'settings') return path('settings', 'preferences');
  return path(tab);
};

function legacyRedirect(pathname: string): string | null {
  if (pathname === '/') return '/review/today';
  if (pathname === '/today') return '/review/today';
  if (pathname === '/on-course') return '/play/shot-picker';
  if (pathname === '/journal') return '/review/journal';
  if (pathname === '/club-gapping') return '/play/club-gapping';
  if (pathname === '/bag') return '/play/club-gapping';
  if (pathname === '/bag/gapping' || pathname === '/settings/bag' || pathname === '/settings/bag/gapping' || pathname === '/play/bag/gapping') return '/play/club-gapping';
  if (pathname === '/bag/short-game' || pathname === '/settings/bag/short-game' || pathname === '/play/bag/short-game') return '/play/short-game-matrix';
  if (pathname === '/bag/profiles' || pathname === '/settings/bag/profiles' || pathname === '/play/bag/profiles') return '/settings/shot-profiles';
  if (pathname === '/bag/clubs' || pathname === '/settings/bag/clubs' || pathname === '/play/bag/clubs') return '/play/club-gapping';
  if (pathname === '/partners') return '/settings/partners';
  if (pathname === '/analyse' || pathname === '/analyse/overview' || pathname === '/playing-data') return '/review/rounds';
  if (pathname === '/analyse/rounds' || pathname === '/playing-data/dashboard') return '/review/rounds';
  if (pathname === '/analyse/clubs' || pathname === '/playing-data/all-clubs' || pathname === '/analyse/gapping') return '/play/club-gapping';
  if (pathname === '/analyse/reports' || pathname === '/playing-data/reports') return '/review/advanced';
  if (pathname === '/analyse/upload' || pathname === '/playing-data/upload') return '/settings/upload';
  if (pathname === '/library') return '/settings/library';
  if (pathname === '/more') return '/settings/upload';
  if (pathname.startsWith('/more/')) return pathname.replace('/more/settings', '/settings/preferences').replace('/more/', '/settings/');
  return null;
}

function SectionTabs({ value, values, labels, onChange }: { value: string; values: readonly string[]; labels: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList className="mb-5 h-auto w-full justify-start overflow-x-auto rounded-lg border bg-muted/30 p-1 sm:w-auto">
        {values.map(item => <TabsTrigger key={item} value={item} className="min-h-10 shrink-0 px-4 font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">{labels[item]}</TabsTrigger>)}
      </TabsList>
    </Tabs>
  );
}

const Index = () => {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab = 'review', child] = location.pathname.split('/').filter(Boolean);
  const selectedRoundDate = new URLSearchParams(location.search).get('round') ?? '';
  const redirect = legacyRedirect(location.pathname);

  if (redirect) return <Navigate to={redirect} replace />;
  if (!isIn(mainTabs, activeTab)) return <Navigate to="/review/today" replace />;
  if (activeTab === 'play' && !isIn(playTabs, child || 'shot-picker')) return <Navigate to="/play/shot-picker" replace />;
  if (activeTab === 'review' && !isIn(reviewTabs, child || 'today')) return <Navigate to="/review/today" replace />;
  if (activeTab === 'settings' && !isIn(settingsTabs, child || 'preferences')) return <Navigate to="/settings/preferences" replace />;

  const playTab = isIn(playTabs, child || '') ? child : 'shot-picker';
  const reviewTab = isIn(reviewTabs, child || '') ? child : 'today';
  const settingsTab = isIn(settingsTabs, child || '') ? child : 'preferences';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="space-y-3 lg:flex lg:items-center lg:gap-4 lg:space-y-0">
            <div className="flex min-w-0 items-center justify-between gap-4 lg:contents">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary"><Goal className="h-6 w-6 text-primary-foreground" /></div>
                <div className="min-w-0"><h1 className="truncate text-xl font-bold">Nic&apos;s Golf Hub</h1><p className="hidden truncate text-sm text-muted-foreground xl:block">Know what matters. Practise with intent.</p></div>
              </div>
              <div className="flex min-w-0 shrink-0 items-center gap-3 lg:order-3">
                <span className="hidden max-w-[260px] truncate text-sm text-muted-foreground sm:inline">{user?.email}</span>
                <Button variant="outline" size="sm" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign Out</Button>
              </div>
            </div>
            <Tabs value={activeTab} onValueChange={value => isIn(mainTabs, value) && navigate(mainPath(value))} className="min-w-0 lg:flex-1">
              <TabsList className="w-full justify-start overflow-x-auto lg:w-auto">
                <TabsTrigger value="play" className="shrink-0 gap-2"><Crosshair className="h-4 w-4" />Play</TabsTrigger>
                <TabsTrigger value="review" className="shrink-0 gap-2"><BarChart3 className="h-4 w-4" />Review</TabsTrigger>
                <TabsTrigger value="practice" className="shrink-0 gap-2"><Target className="h-4 w-4" />Practice</TabsTrigger>
                <TabsTrigger value="settings" className="shrink-0 gap-2"><SettingsIcon className="h-4 w-4" />Settings</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </header>
      <main className="container py-6">
        <Suspense fallback={<TabLoader />}>
          {activeTab === 'play' && <>
            <SectionTabs value={playTab} values={playTabs} labels={{ 'shot-picker': 'Shot Picker', 'short-game-matrix': 'Short Game Matrix', 'club-gapping': 'Club Gapping', cues: 'On-Course Cues' }} onChange={value => navigate(path('play', value))} />
            {playTab === 'shot-picker' && <ClubSelectorTab defaultView="club-selector" singleView />}
            {playTab === 'short-game-matrix' && <ClubSelectorTab defaultView="wedge-matrix" singleView />}
            {playTab === 'club-gapping' && <ClubGappingTab />}
            {playTab === 'cues' && <OnCourseCuesTab />}
          </>}
          {activeTab === 'practice' && <PracticeTab />}
          {activeTab === 'review' && <>
            <SectionTabs value={reviewTab} values={reviewTabs} labels={{ today: 'Today', rounds: 'Round Review', journal: 'Journal', advanced: 'Advanced Reports' }} onChange={value => navigate(path('review', value))} />
            {reviewTab === 'today' && <AnalysisOverview onOpenPractice={() => navigate('/practice')} onOpenLatestRound={() => navigate('/review/rounds')} />}
            {reviewTab === 'rounds' && <DashboardTab showOverview={false} initialRoundDate={selectedRoundDate} onOpenUpload={() => navigate('/settings/upload')} onOpenJournal={() => navigate('/review/journal')} />}
            {reviewTab === 'journal' && <JournalTab />}
            {reviewTab === 'advanced' && <div className="space-y-6"><ReportsTab /><DashboardTab initialView="overview" showLatestRound={false} /></div>}
          </>}
          {activeTab === 'settings' && <>
            <SectionTabs value={settingsTab} values={settingsTabs} labels={{ partners: 'Partners', 'shot-profiles': 'Shot Profiles', upload: 'Upload', library: 'Drill Library', tools: 'Tools & Definitions', preferences: 'Preferences' }} onChange={value => navigate(path('settings', value))} />
            {settingsTab === 'partners' && <PlayingPartnersTab />}
            {settingsTab === 'shot-profiles' && <ShotProfilesCard />}
            {settingsTab === 'upload' && <UploadTab />}
            {settingsTab === 'library' && <LibraryTab />}
            {settingsTab === 'tools' && <MoreToolsTab />}
            {settingsTab === 'preferences' && <SettingsTab />}
          </>}
        </Suspense>
      </main>
    </div>
  );
};

export default Index;
