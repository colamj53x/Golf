import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PracticeDrillsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Drills</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Drills and technique training you can do. Coming soon — this will host a library of
        drills tied to the weaknesses surfaced in your practice plan.
      </CardContent>
    </Card>
  );
}
