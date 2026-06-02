import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BlastMotionTargetsCard } from '@/components/putting/BlastMotionTargetsCard';

export function MoreToolsTab() {
  return (
    <div className="space-y-6">
      <BlastMotionTargetsCard />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Definitions Reference</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div><strong className="text-foreground">On-Target:</strong> Lateral finish inside the accepted miss width for that club/shot</div>
          <div><strong className="text-foreground">Right/Left %:</strong> Shots finishing outside the accepted miss width in that direction</div>
          <div><strong className="text-foreground">Short %:</strong> Shots finishing meaningfully short of the expected distance, unless "As Intended"</div>
          <div><strong className="text-foreground">Bad Miss %:</strong> Penalty or Recovery required (punch-out, chip-out)</div>
          <div><strong className="text-foreground">Distance-to-Target:</strong> Only calculated for shots targeting the green</div>
          <div><strong className="text-foreground">Greens Targeted %:</strong> Percentage of shots where target is within tolerance of stock distance</div>
        </CardContent>
      </Card>
    </div>
  );
}
