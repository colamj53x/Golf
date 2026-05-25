import { useState } from 'react';
import { DashboardTab } from '@/components/DashboardTab';
import { AllClubsTab } from '@/components/AllClubsTab';
import { SettingsTab } from '@/components/SettingsTab';
import { UploadTab } from '@/components/UploadTab';
import { PracticeTab } from '@/components/PracticeTab';
import { ClubSelectorTab } from '@/components/ClubSelectorTab';
import { ReportsTab } from '@/components/reports/ReportsTab';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Settings, Target, LogOut, TrendingUp, Database } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const Index = () => {
  const [activeTab, setActiveTab] = useState('playing-data');
  const { signOut, user } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-6 w-6 text-primary-foreground"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="18" r="3" />
                  <path d="M12 15V4" />
                  <path d="M12 4l4 3" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Golf Performance</h1>
                <p className="text-sm text-muted-foreground">Club Analytics Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user?.email}
              </span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
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
          <TabsList className="mb-6">
            <TabsTrigger value="playing-data" className="gap-2">
              <Database className="h-4 w-4" />
              Playing Data
            </TabsTrigger>
            <TabsTrigger value="practice" className="gap-2">
              <Target className="h-4 w-4" />
              Practice
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="playing-data">
            <Tabs defaultValue="dashboard" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="all-clubs">All Clubs</TabsTrigger>
                <TabsTrigger value="club-selector">Club Selector</TabsTrigger>
                <TabsTrigger value="upload">Upload</TabsTrigger>
              </TabsList>
              <TabsContent value="dashboard">
                <DashboardTab />
              </TabsContent>
              <TabsContent value="all-clubs">
                <AllClubsTab />
              </TabsContent>
              <TabsContent value="club-selector">
                <ClubSelectorTab />
              </TabsContent>
              <TabsContent value="upload">
                <UploadTab />
              </TabsContent>
            </Tabs>
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
