import { Suspense, lazy } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, Target, LogOut, TrendingUp, Database, Goal, Crosshair, Gauge } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

const DashboardTab = lazy(async () => ({
  default: (await import('@/components/DashboardTab')).DashboardTab,
}));
const AllClubsTab = lazy(async () => ({
  default: (await import('@/components/AllClubsTab')).AllClubsTab,
}));
const SettingsTab = lazy(async () => ({
  default: (await import('@/components/SettingsTab')).SettingsTab,
}));
const UploadTab = lazy(async () => ({
  default: (await import('@/components/UploadTab')).UploadTab,
}));
const PracticeTab = lazy(async () => ({
  default: (await import('@/components/PracticeTab')).PracticeTab,
}));
const ClubSelectorTab = lazy(async () => ({
  default: (await import('@/components/ClubSelectorTab')).ClubSelectorTab,
}));
const ClubGappingTab = lazy(async () => ({
  default: (await import('@/components/ClubGappingTab')).ClubGappingTab,
}));
const ReportsTab = lazy(async () => ({
  default: (await import('@/components/reports/ReportsTab')).ReportsTab,
}));

const playingDataTabs = ['dashboard', 'all-clubs', 'upload', 'reports'] as const;
const mainTabs = ['on-course', 'club-gapping', 'playing-data', 'practice', 'settings'] as const;

type PlayingDataTab = typeof playingDataTabs[number];
type MainTab = typeof mainTabs[number];

const defaultPlayingDataTab: PlayingDataTab = 'dashboard';

const TabLoader = () => (
  <div className="space-y-4">
    <Skeleton className="h-10 w-48" />
    <Skeleton className="h-64 w-full" />
    <Skeleton className="h-32 w-full" />
  </div>
);

const isMainTab = (value: string): value is MainTab =>
  mainTabs.includes(value as MainTab);

const isPlayingDataTab = (value: string): value is PlayingDataTab =>
  playingDataTabs.includes(value as PlayingDataTab);

const getPathForTab = (tab: MainTab, playingDataTab: PlayingDataTab = defaultPlayingDataTab) =>
  tab === 'playing-data' ? `/playing-data/${playingDataTab}` : `/${tab}`;

const Index = () => {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeTab = pathParts[0] || 'playing-data';
  const playingDataTab = pathParts[1] || defaultPlayingDataTab;

  if (location.pathname === '/') {
    return <Navigate to={getPathForTab('playing-data')} replace />;
  }

  if (!isMainTab(activeTab)) {
    return <Navigate to={getPathForTab('playing-data')} replace />;
  }

  if (activeTab === 'playing-data' && !isPlayingDataTab(playingDataTab)) {
    return <Navigate to={getPathForTab('playing-data')} replace />;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  const handleMainTabChange = (tab: string) => {
    if (isMainTab(tab)) {
      navigate(getPathForTab(tab, isPlayingDataTab(playingDataTab) ? playingDataTab : defaultPlayingDataTab));
    }
  };

  const handlePlayingDataTabChange = (tab: string) => {
    if (isPlayingDataTab(tab)) {
      navigate(getPathForTab('playing-data', tab));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="space-y-3">
            <div className="flex min-w-0 items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
                  <Goal className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-bold text-foreground">Nic&apos;s Golf Hub</h1>
                  <p className="truncate text-sm text-muted-foreground">Rounds, practice, putting, and club trends</p>
                </div>
              </div>
              <div className="flex min-w-0 shrink-0 items-center gap-3">
                <span className="hidden max-w-[260px] truncate text-sm text-muted-foreground sm:inline">
                  {user?.email}
                </span>
                <Button variant="outline" size="sm" onClick={handleSignOut} className="shrink-0">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </div>
            <Tabs value={activeTab} onValueChange={handleMainTabChange} className="min-w-0">
              <TabsList className="w-full justify-start overflow-x-auto lg:w-auto">
                <TabsTrigger value="on-course" className="shrink-0 gap-2">
                  <Crosshair className="h-4 w-4" />
                  On Course
                </TabsTrigger>
                <TabsTrigger value="club-gapping" className="shrink-0 gap-2">
                  <Gauge className="h-4 w-4" />
                  Club Gapping
                </TabsTrigger>
                <TabsTrigger value="playing-data" className="shrink-0 gap-2">
                  <Database className="h-4 w-4" />
                  Playing Data
                </TabsTrigger>
                <TabsTrigger value="practice" className="shrink-0 gap-2">
                  <Target className="h-4 w-4" />
                  Practice
                </TabsTrigger>
                <TabsTrigger value="settings" className="shrink-0 gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <Tabs value={activeTab} onValueChange={handleMainTabChange}>
          <TabsContent value="playing-data">
            <Tabs value={playingDataTab} onValueChange={handlePlayingDataTabChange} className="w-full">
              <TabsList className="mb-4 w-full justify-start overflow-x-auto sm:w-auto">
                <TabsTrigger value="dashboard" className="shrink-0">Dashboard</TabsTrigger>
                <TabsTrigger value="all-clubs" className="shrink-0">All Clubs</TabsTrigger>
                <TabsTrigger value="upload" className="shrink-0">Upload</TabsTrigger>
                <TabsTrigger value="reports" className="shrink-0 gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Reports
                </TabsTrigger>
              </TabsList>
              <TabsContent value="dashboard">
                <Suspense fallback={<TabLoader />}>
                  <DashboardTab onOpenUpload={() => {
                    navigate(getPathForTab('playing-data', 'upload'));
                  }} />
                </Suspense>
              </TabsContent>
              <TabsContent value="all-clubs">
                <Suspense fallback={<TabLoader />}>
                  <AllClubsTab />
                </Suspense>
              </TabsContent>
              <TabsContent value="upload">
                <Suspense fallback={<TabLoader />}>
                  <UploadTab />
                </Suspense>
              </TabsContent>
              <TabsContent value="reports">
                <Suspense fallback={<TabLoader />}>
                  <ReportsTab />
                </Suspense>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="on-course">
            <Suspense fallback={<TabLoader />}>
              <ClubSelectorTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="club-gapping">
            <Suspense fallback={<TabLoader />}>
              <ClubGappingTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="practice">
            <Suspense fallback={<TabLoader />}>
              <PracticeTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="settings">
            <Suspense fallback={<TabLoader />}>
              <SettingsTab />
            </Suspense>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
