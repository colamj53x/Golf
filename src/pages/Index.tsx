import { Suspense, lazy } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, BookOpen, BriefcaseBusiness, Crosshair, Goal, Home, LogOut, MoreHorizontal, Target, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DashboardTab = lazy(async () => ({ default: (await import('@/components/DashboardTab')).DashboardTab }));
const AnalysisOverview = lazy(async () => ({ default: (await import('@/components/analysis/AnalysisOverview')).AnalysisOverview }));
const AllClubsTab = lazy(async () => ({ default: (await import('@/components/AllClubsTab')).AllClubsTab }));
const SettingsTab = lazy(async () => ({ default: (await import('@/components/SettingsTab')).SettingsTab }));
const ShotProfilesCard = lazy(async () => ({ default: (await import('@/components/SettingsTab')).ShotProfilesCard }));
const UploadTab = lazy(async () => ({ default: (await import('@/components/UploadTab')).UploadTab }));
const PracticeTab = lazy(async () => ({ default: (await import('@/components/PracticeTab')).PracticeTab }));
const ClubSelectorTab = lazy(async () => ({ default: (await import('@/components/ClubSelectorTab')).ClubSelectorTab }));
const ClubGappingTab = lazy(async () => ({ default: (await import('@/components/ClubGappingTab')).ClubGappingTab }));
const ReportsTab = lazy(async () => ({ default: (await import('@/components/reports/ReportsTab')).ReportsTab }));
const LibraryTab = lazy(async () => ({ default: (await import('@/components/LibraryTab')).LibraryTab }));
const MoreToolsTab = lazy(async () => ({ default: (await import('@/components/MoreToolsTab')).MoreToolsTab }));
const PlayingPartnersTab = lazy(async () => ({ default: (await import('@/components/PlayingPartnersTab')).PlayingPartnersTab }));
const JournalTab = lazy(async () => ({ default: (await import('@/components/JournalTab')).JournalTab }));

const mainTabs = ['today', 'play', 'review', 'journal', 'practice', 'bag', 'partners', 'more'] as const;
const reviewTabs = ['rounds', 'advanced'] as const;
const bagTabs = ['gapping', 'clubs', 'profiles', 'short-game'] as const;
const moreTabs = ['upload', 'library', 'tools', 'settings'] as const;
type MainTab = typeof mainTabs[number];

const TabLoader = () => <div className="space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /><Skeleton className="h-32 w-full" /></div>;
const isIn = <T extends readonly string[]>(items: T, value: string): value is T[number] => items.includes(value as T[number]);
const path = (tab: MainTab, child?: string) => `/${tab}${child ? `/${child}` : ''}`;

function legacyRedirect(pathname: string): string | null {
  if (pathname === '/') return '/today';
  if (pathname === '/on-course') return '/play';
  if (pathname === '/club-gapping') return '/bag/gapping';
  if (pathname === '/analyse' || pathname === '/analyse/overview' || pathname === '/playing-data') return '/review/rounds';
  if (pathname === '/analyse/rounds' || pathname === '/playing-data/dashboard') return '/review/rounds';
  if (pathname === '/analyse/clubs' || pathname === '/playing-data/all-clubs') return '/bag/clubs';
  if (pathname === '/analyse/gapping') return '/bag/gapping';
  if (pathname === '/analyse/reports' || pathname === '/playing-data/reports') return '/review/advanced';
  if (pathname === '/analyse/upload' || pathname === '/playing-data/upload') return '/more/upload';
  if (pathname === '/library') return '/more/library';
  if (pathname === '/settings') return '/more/settings';
  return null;
}

function SectionTabs({ value, values, labels, onChange }: { value: string; values: readonly string[]; labels: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList className="mb-4 w-full justify-start overflow-x-auto sm:w-auto">
        {values.map(item => <TabsTrigger key={item} value={item} className="shrink-0">{labels[item]}</TabsTrigger>)}
      </TabsList>
    </Tabs>
  );
}

const Index = () => {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab = 'today', child] = location.pathname.split('/').filter(Boolean);
  const selectedRoundDate = new URLSearchParams(location.search).get('round') ?? '';
  const redirect = legacyRedirect(location.pathname);

  if (redirect) return <Navigate to={redirect} replace />;
  if (!isIn(mainTabs, activeTab)) return <Navigate to="/today" replace />;
  if (activeTab === 'review' && !isIn(reviewTabs, child || 'rounds')) return <Navigate to="/review/rounds" replace />;
  if (activeTab === 'bag' && !isIn(bagTabs, child || 'gapping')) return <Navigate to="/bag/gapping" replace />;
  if (activeTab === 'more' && !isIn(moreTabs, child || 'upload')) return <Navigate to="/more/upload" replace />;

  const reviewTab = isIn(reviewTabs, child || '') ? child : 'rounds';
  const bagTab = isIn(bagTabs, child || '') ? child : 'gapping';
  const moreTab = isIn(moreTabs, child || '') ? child : 'upload';

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
            <Tabs value={activeTab} onValueChange={value => isIn(mainTabs, value) && navigate(path(value))} className="min-w-0 lg:flex-1">
              <TabsList className="w-full justify-start overflow-x-auto lg:w-auto">
                <TabsTrigger value="today" className="shrink-0 gap-2"><Home className="h-4 w-4" />Today</TabsTrigger>
                <TabsTrigger value="play" className="shrink-0 gap-2"><Crosshair className="h-4 w-4" />Play</TabsTrigger>
                <TabsTrigger value="review" className="shrink-0 gap-2"><BarChart3 className="h-4 w-4" />Review</TabsTrigger>
                <TabsTrigger value="journal" className="shrink-0 gap-2"><BookOpen className="h-4 w-4" />Journal</TabsTrigger>
                <TabsTrigger value="practice" className="shrink-0 gap-2"><Target className="h-4 w-4" />Practice</TabsTrigger>
                <TabsTrigger value="bag" className="shrink-0 gap-2"><BriefcaseBusiness className="h-4 w-4" />Bag</TabsTrigger>
                <TabsTrigger value="partners" className="shrink-0 gap-2"><Users className="h-4 w-4" />Partners</TabsTrigger>
                <TabsTrigger value="more" className="shrink-0 gap-2"><MoreHorizontal className="h-4 w-4" />More</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </header>
      <main className="container py-6">
        <Suspense fallback={<TabLoader />}>
          {activeTab === 'today' && <AnalysisOverview onOpenPractice={() => navigate('/practice')} onOpenLatestRound={() => navigate('/review/rounds')} />}
          {activeTab === 'play' && <ClubSelectorTab />}
          {activeTab === 'practice' && <PracticeTab />}
          {activeTab === 'review' && <>
            <SectionTabs value={reviewTab} values={reviewTabs} labels={{ rounds: 'Round Review', advanced: 'Advanced Reports' }} onChange={value => navigate(path('review', value))} />
            {reviewTab === 'rounds' && <DashboardTab showOverview={false} initialRoundDate={selectedRoundDate} onOpenUpload={() => navigate('/more/upload')} />}
            {reviewTab === 'advanced' && <div className="space-y-6"><ReportsTab /><DashboardTab initialView="overview" showLatestRound={false} /></div>}
          </>}
          {activeTab === 'journal' && <JournalTab />}
          {activeTab === 'bag' && <>
            <SectionTabs value={bagTab} values={bagTabs} labels={{ gapping: 'Gapping', clubs: 'Clubs & Distances', profiles: 'Shot Profiles', 'short-game': 'Short Game Matrix' }} onChange={value => navigate(path('bag', value))} />
            {bagTab === 'gapping' && <ClubGappingTab />}
            {bagTab === 'clubs' && <AllClubsTab />}
            {bagTab === 'profiles' && <ShotProfilesCard />}
            {bagTab === 'short-game' && <ClubSelectorTab defaultView="wedge-matrix" />}
          </>}
          {activeTab === 'partners' && <PlayingPartnersTab />}
          {activeTab === 'more' && <>
            <SectionTabs value={moreTab} values={moreTabs} labels={{ upload: 'Upload', library: 'Drill Library', tools: 'Tools & Definitions', settings: 'Settings' }} onChange={value => navigate(path('more', value))} />
            {moreTab === 'upload' && <UploadTab />}
            {moreTab === 'library' && <LibraryTab />}
            {moreTab === 'tools' && <MoreToolsTab />}
            {moreTab === 'settings' && <SettingsTab />}
          </>}
        </Suspense>
      </main>
    </div>
  );
};

export default Index;
