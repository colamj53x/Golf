import { Card, CardContent } from '@/components/ui/card';
import { Home, TreePine } from 'lucide-react';

interface Props {
  onSelect: (category: 'indoor' | 'outdoor') => void;
}

export function PuttingHome({ onSelect }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card
        className="cursor-pointer transition hover:border-primary hover:shadow-md"
        onClick={() => onSelect('indoor')}
      >
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
          <Home className="h-12 w-12 text-primary" />
          <h3 className="text-xl font-bold">Indoor</h3>
          <p className="text-sm text-muted-foreground text-center">
            Carpet putting drills — Start Line & Short Putt Control
          </p>
        </CardContent>
      </Card>

      <Card className="cursor-not-allowed opacity-60">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
          <TreePine className="h-12 w-12 text-muted-foreground" />
          <h3 className="text-xl font-bold">Outdoor</h3>
          <p className="text-sm text-muted-foreground text-center">Coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
