/* eslint-disable react-refresh/only-export-components */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export interface RoundReflectionDraft {
  drivingNotes: string;
  ironsNotes: string;
  shortNotes: string;
  puttingNotes: string;
  mentalNotes: string;
  courseManagementNotes: string;
}

interface RoundReflectionEditorProps {
  title: string;
  description: string;
  value: RoundReflectionDraft;
  onChange: (next: RoundReflectionDraft) => void;
  onSave?: () => Promise<void> | void;
  isSaving?: boolean;
  saveLabel?: string;
}

type ReflectionField = {
  key: keyof RoundReflectionDraft;
  label: string;
  placeholder: string;
};

const FIELDS: ReflectionField[] = [
  {
    key: 'drivingNotes',
    label: 'Driving',
    placeholder: 'Fairways, misses, strike, shape, and what showed up under pressure.',
  },
  {
    key: 'ironsNotes',
    label: 'Irons and Hybrids',
    placeholder: 'Distance control, contact, start line, and patterns with irons and hybrids.',
  },
  {
    key: 'shortNotes',
    label: 'Short',
    placeholder: 'Chipping, pitching, bunker play, and scoring shots around the green.',
  },
  {
    key: 'puttingNotes',
    label: 'Putting',
    placeholder: 'Start line, pace, reads, short putts, and any recurring miss.',
  },
  {
    key: 'mentalNotes',
    label: 'Mental',
    placeholder: 'Confidence, focus, resilience, emotions, and pre-shot commitment.',
  },
  {
    key: 'courseManagementNotes',
    label: 'Course Management',
    placeholder: 'Club choice, targets, strategy, and any holes or decisions that swung the round.',
  },
];

export function createEmptyRoundReflectionDraft(): RoundReflectionDraft {
  return {
    drivingNotes: '',
    ironsNotes: '',
    shortNotes: '',
    puttingNotes: '',
    mentalNotes: '',
    courseManagementNotes: '',
  };
}

export function hasRoundReflectionContent(value: RoundReflectionDraft): boolean {
  return Object.values(value).some((entry) => entry.trim().length > 0);
}

export function RoundReflectionEditor({
  title,
  description,
  value,
  onChange,
  onSave,
  isSaving = false,
  saveLabel = 'Save Round Thoughts',
}: RoundReflectionEditorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Textarea
                id={field.key}
                value={value[field.key]}
                onChange={(event) => onChange({
                  ...value,
                  [field.key]: event.target.value,
                })}
                placeholder={field.placeholder}
                className="min-h-[110px]"
              />
            </div>
          ))}
        </div>
        {onSave && (
          <div className="flex justify-end">
            <Button onClick={() => void onSave()} disabled={isSaving}>
              {isSaving ? 'Saving...' : saveLabel}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
