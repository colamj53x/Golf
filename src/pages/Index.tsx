import { useState } from 'react';
import { DashboardTab } from '@/components/DashboardTab';
import { AllClubsTab } from '@/components/AllClubsTab';
import { SettingsTab } from '@/components/SettingsTab';
import { UploadTab } from '@/components/UploadTab';
import { PracticeTab } from '@/components/PracticeTab';
import { ClubSelectorTab } from '@/components/ClubSelectorTab';
import { ClubGappingTab } from '@/components/ClubGappingTab';
import { ReportsTab } from '@/components/reports/ReportsTab';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Settings, Target, LogOut, TrendingUp, Database, Goal, Crosshair, Gauge } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const Index = () => {
  const [activeTab, setActiveTab] = useState('playing-data');
  const [playingDataTab, setPlayingDataTab] = useState('dashboard');
  const { signOut, user } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
                <Goal className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-foreground">Golf Stats Hub</h1>
                <p className="text-sm text-muted-foreground">Rounds, practice, putting, and club trends</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4">
              <span className="truncate text-sm text-muted-foreground">
                {user?.email}
              </span>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="shrink-0">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="playing-data" className="shrink-0 gap-2">
              <Database className="h-4 w-4" />
              Playing Data
            </TabsTrigger>
            <TabsTrigger value="on-course" className="shrink-0 gap-2">
              <Crosshair className="h-4 w-4" />
              On Course
            </TabsTrigger>
            <TabsTrigger value="club-gapping" className="shrink-0 gap-2">
              <Gauge className="h-4 w-4" />
              Club Gapping
            </TabsTrigger>
            <TabsTrigger value="practice" className="shrink-0 gap-2">
              <Target className="h-4 w-4" />
              Practice
            </TabsTrigger>
            <TabsTrigger value="reports" className="shrink-0 gap-2">
              <TrendingUp className="h-4 w-4" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="settings" className="shrink-0 gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="playing-data">
            <Tabs value={playingDataTab} onValueChange={setPlayingDataTab} className="w-full">
              <TabsList className="mb-4 w-full justify-start overflow-x-auto sm:w-auto">
                <TabsTrigger value="dashboard" className="shrink-0">Dashboard</TabsTrigger>
                <TabsTrigger value="all-clubs" className="shrink-0">All Clubs</TabsTrigger>
                <TabsTrigger value="upload" className="shrink-0">Upload</TabsTrigger>
              </TabsList>
              <TabsContent value="dashboard">
                <DashboardTab onOpenUpload={() => {
                  setActiveTab('playing-data');
                  setPlayingDataTab('upload');
                }} />
              </TabsContent>
              <TabsContent value="all-clubs">
                <AllClubsTab />
              </TabsContent>
              <TabsContent value="upload">
                <UploadTab />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="on-course">
            <ClubSelectorTab />
          </TabsContent>

          <TabsContent value="club-gapping">
            <ClubGappingTab />
          </TabsContent>

          <TabsContent value="practice">
            <PracticeTab />
          </TabsContent>

          <TabsContent value="reports">
            <ReportsTab />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
