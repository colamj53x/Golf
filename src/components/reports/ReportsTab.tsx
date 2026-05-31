import React, { Suspense, lazy, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Ruler, Layers, Calendar, GitCompare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const ReportsByClub = lazy(async () => ({
  default: (await import('./ReportsByClub')).ReportsByClub,
}));
const ReportsByDistance = lazy(async () => ({
  default: (await import('./ReportsByDistance')).ReportsByDistance,
}));
const ReportsByLie = lazy(async () => ({
  default: (await import('./ReportsByLie')).ReportsByLie,
}));
const ReportsByTime = lazy(async () => ({
  default: (await import('./ReportsByTime')).ReportsByTime,
}));
const ReportsComparative = lazy(async () => ({
  default: (await import('./ReportsComparative')).ReportsComparative,
}));

const ReportLoader = () => (
  <div className="space-y-4">
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-72 w-full" />
  </div>
);

export function ReportsTab() {
  const [activeReport, setActiveReport] = useState('club');

  return (
    <div className="space-y-6 animate-fade-in">
      <Tabs value={activeReport} onValueChange={setActiveReport}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="club" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">By Club</span>
          </TabsTrigger>
          <TabsTrigger value="distance" className="gap-2">
            <Ruler className="h-4 w-4" />
            <span className="hidden sm:inline">By Distance</span>
          </TabsTrigger>
          <TabsTrigger value="lie" className="gap-2">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">By Lie</span>
          </TabsTrigger>
          <TabsTrigger value="time" className="gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">By Time</span>
          </TabsTrigger>
          <TabsTrigger value="compare" className="gap-2">
            <GitCompare className="h-4 w-4" />
            <span className="hidden sm:inline">Compare</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="club" className="mt-6">
          <Suspense fallback={<ReportLoader />}>
            <ReportsByClub />
          </Suspense>
        </TabsContent>
        <TabsContent value="distance" className="mt-6">
          <Suspense fallback={<ReportLoader />}>
            <ReportsByDistance />
          </Suspense>
        </TabsContent>
        <TabsContent value="lie" className="mt-6">
          <Suspense fallback={<ReportLoader />}>
            <ReportsByLie />
          </Suspense>
        </TabsContent>
        <TabsContent value="time" className="mt-6">
          <Suspense fallback={<ReportLoader />}>
            <ReportsByTime />
          </Suspense>
        </TabsContent>
        <TabsContent value="compare" className="mt-6">
          <Suspense fallback={<ReportLoader />}>
            <ReportsComparative />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
