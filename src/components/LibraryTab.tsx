import { useState } from 'react';
import { BookOpen, CircleDot, Dumbbell } from 'lucide-react';
import { DrillBankTab } from '@/components/DrillBankTab';
import { PuttingDrillBankTab } from '@/components/putting/PuttingDrillBankTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function LibraryTab() {
  const [section, setSection] = useState('full-swing');

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">Library</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Your reusable drill definitions and practice building blocks.
        </p>
      </div>
      <Tabs value={section} onValueChange={setSection}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="full-swing" className="shrink-0 gap-2">
            <Dumbbell className="h-4 w-4" />
            Full Swing Drills
          </TabsTrigger>
          <TabsTrigger value="putting" className="shrink-0 gap-2">
            <CircleDot className="h-4 w-4" />
            Putting Drills
          </TabsTrigger>
        </TabsList>
        <TabsContent value="full-swing" className="mt-4">
          <DrillBankTab />
        </TabsContent>
        <TabsContent value="putting" className="mt-4">
          <PuttingDrillBankTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
