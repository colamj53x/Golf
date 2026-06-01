import { Suspense, lazy } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, BookOpen, Crosshair, Gauge, Goal, LogOut, Settings, Target, TrendingUp, Upload } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

const DashboardTab = lazy(async () => ({
  default: (await import('@/components/DashboardTab')).DashboardTab,
}));
const AnalysisOverview = lazy(async () => ({
  default: (await import('@/components/analysis/AnalysisOverview')).AnalysisOverview,
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
const LibraryTab = lazy(async () => ({
  default: (await import('@/components/LibraryTab')).LibraryTab,
}));

const analyseTabs = ['overview', 'rounds', 'clubs', 'gapping', 'reports', 'upload'] as const;
const mainTabs = ['play', 'practice', 'analyse', 'library', 'settings'] as const;

type AnalyseTab = typeof analyseTabs[number];
type MainTab = typeof mainTabs[number];

const defaultAnalyseTab: AnalyseTab = 'overview';

const TabLoader = () => (
  <div className="space-y-4">
    <Skeleton className="h-10 w-48" />
    <Skeleton className="h-64 w-full" />
    <Skeleton className="h-32 w-full" />
  </div>
);

const isMainTab = (value: string): value is MainTab =>
  mainTabs.includes(value as MainTab);

const isAnalyseTab = (value: string): value is AnalyseTab =>
  analyseTabs.includes(value as AnalyseTab);

const getPathForTab = (tab: MainTab, analyseTab: AnalyseTab = defaultAnalyseTab) =>
  tab === 'analyse' ? `/analyse/${analyseTab}` : `/${tab}`;

function legacyRedirect(pathname: string): string | null {
  if (pathname === '/on-course') return '/play';
  if (pathname === '/club-gapping') return '/analyse/gapping';
  if (pathname.startsWith('/playing-data/')) {
    const legacyTab = pathname.split('/').filter(Boolean)[1];
    if (legacyTab === 'dashboard') return '/analyse/rounds';
    if (legacyTab === 'all-clubs') return '/analyse/clubs';
    if (legacyTab === 'reports') return '/analyse/reports';
    if (legacyTab === 'upload') return '/analyse/upload';
  }
  if (pathname === '/playing-data') return '/analyse/overview';
  return null;
}

const Index = () => {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeTab = pathParts[0] || 'analyse';
  const analyseTab = pathParts[1] || defaultAnalyseTab;
  const redirect = legacyRedirect(location.pathname);

  if (location.pathname === '/') {
    return <Navigate to={getPathForTab('analyse')} replace />;
  }

  if (redirect) {
    return <Navigate to={redirect} replace />;
  }

  if (!isMainTab(activeTab)) {
    return <Navigate to={getPathForTab('analyse')} replace />;
  }

  if (activeTab === 'analyse' && !isAnalyseTab(analyseTab)) {
    return <Navigate to={getPathForTab('analyse')} replace />;
  }

  const handleMainTabChange = (tab: string) => {
    if (isMainTab(tab)) {
      navigate(getPathForTab(tab, isAnalyseTab(analyseTab) ? analyseTab : defaultAnalyseTab));
    }
  };

  const handleAnalyseTabChange = (tab: string) => {
    if (isAnalyseTab(tab)) navigate(getPathForTab('analyse', tab));
  };

  return (
    <div className="min-h-screen bg-background">
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
                  <p className="truncate text-sm text-muted-foreground">Play, practise, analyse, repeat.</p>
                </div>
              </div>
              <div className="flex min-w-0 shrink-0 items-center gap-3">
                <span className="hidden max-w-[260px] truncate text-sm text-muted-foreground sm:inline">
                  {user?.email}
                </span>
                <Button variant="outline" size="sm" onClick={signOut} className="shrink-0">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </div>
            <Tabs value={activeTab} onValueChange={handleMainTabChange} className="min-w-0">
              <TabsList className="w-full justify-start overflow-x-auto lg:w-auto">
                <TabsTrigger value="play" className="shrink-0 gap-2">
                  <Crosshair className="h-4 w-4" />
                  Play
                </TabsTrigger>
                <TabsTrigger value="practice" className="shrink-0 gap-2">
                  <Target className="h-4 w-4" />
                  Practice
                </TabsTrigger>
                <TabsTrigger value="analyse" className="shrink-0 gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Analyse
                </TabsTrigger>
                <TabsTrigger value="library" className="shrink-0 gap-2">
                  <BookOpen className="h-4 w-4" />
                  Library
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

      <main className="container py-6">
        <Tabs value={activeTab} onValueChange={handleMainTabChange}>
          <TabsContent value="play">
            <Suspense fallback={<TabLoader />}>
              <ClubSelectorTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="practice">
            <Suspense fallback={<TabLoader />}>
              <PracticeTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="analyse">
            <Tabs value={analyseTab} onValueChange={handleAnalyseTabChange} className="w-full">
              <TabsList className="mb-4 w-full justify-start overflow-x-auto sm:w-auto">
                <TabsTrigger value="overview" className="shrink-0">Overview</TabsTrigger>
                <TabsTrigger value="rounds" className="shrink-0">Rounds</TabsTrigger>
                <TabsTrigger value="clubs" className="shrink-0">Clubs</TabsTrigger>
                <TabsTrigger value="gapping" className="shrink-0 gap-2">
                  <Gauge className="h-4 w-4" />
                  Gapping
                </TabsTrigger>
                <TabsTrigger value="reports" className="shrink-0 gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Reports
                </TabsTrigger>
                <TabsTrigger value="upload" className="shrink-0 gap-2">
                  <Upload className="h-4 w-4" />
                  Upload
                </TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <Suspense fallback={<TabLoader />}>
                  <AnalysisOverview />
                </Suspense>
              </TabsContent>
              <TabsContent value="rounds">
                <Suspense fallback={<TabLoader />}>
                  <DashboardTab onOpenUpload={() => navigate(getPathForTab('analyse', 'upload'))} />
                </Suspense>
              </TabsContent>
              <TabsContent value="clubs">
                <Suspense fallback={<TabLoader />}>
                  <AllClubsTab />
                </Suspense>
              </TabsContent>
              <TabsContent value="gapping">
                <Suspense fallback={<TabLoader />}>
                  <ClubGappingTab />
                </Suspense>
              </TabsContent>
              <TabsContent value="reports">
                <Suspense fallback={<TabLoader />}>
                  <ReportsTab />
                </Suspense>
              </TabsContent>
              <TabsContent value="upload">
                <Suspense fallback={<TabLoader />}>
                  <UploadTab />
                </Suspense>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="library">
            <Suspense fallback={<TabLoader />}>
              <LibraryTab />
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
