import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReportsByClub } from './ReportsByClub';
import { ReportsByDistance } from './ReportsByDistance';
import { ReportsByLie } from './ReportsByLie';
import { ReportsByTime } from './ReportsByTime';
import { ReportsComparative } from './ReportsComparative';
import { BarChart3, Ruler, Layers, Calendar, GitCompare } from 'lucide-react';

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
          <ReportsByClub />
        </TabsContent>
        <TabsContent value="distance" className="mt-6">
          <ReportsByDistance />
        </TabsContent>
        <TabsContent value="lie" className="mt-6">
          <ReportsByLie />
        </TabsContent>
        <TabsContent value="time" className="mt-6">
          <ReportsByTime />
        </TabsContent>
        <TabsContent value="compare" className="mt-6">
          <ReportsComparative />
        </TabsContent>
      </Tabs>
    </div>
  );
}