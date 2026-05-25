import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Trash2, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useGolfData } from '@/context/GolfDataContext';
import { useAuth } from '@/context/AuthContext';
import { getShotDateKey, parseCSV } from '@/lib/golfCalculations';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { getUserFriendlyError, validateShot } from '@/lib/errorHandler';

export function UploadTab() {
  const { user } = useAuth();
  const { refreshShots, shots } = useGolfData();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<{ row: number; issue: string }[]>([]);
  const [replaceAll, setReplaceAll] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      processFile(file);
    } else {
      setUploadResult({ success: false, message: 'Please drop a CSV file.' });
    }
  };

  const processFile = async (file: File) => {
    setIsUploading(true);
    setUploadResult(null);
    setUploadWarnings([]);

    try {
      const text = await file.text();
      const { shots: parsedShots, warnings } = parseCSV(text);
      
      setUploadWarnings(warnings);

      if (parsedShots.length === 0) {
        setUploadResult({ success: false, message: 'No valid shots found in the CSV file.' });
        return;
      }

      // Validate all shots before processing
      const validationErrors: { row: number; issue: string }[] = [];
      for (let i = 0; i < parsedShots.length; i++) {
        const shot = parsedShots[i];
        const error = validateShot({
          club: shot.club,
          total: shot.total,
          target: shot.target,
          side: shot.side,
          date: shot.date,
          endDistanceFromTarget: shot.endDistanceFromTarget,
        });
        if (error) {
          validationErrors.push({ row: i + 2, issue: error }); // +2 for header row and 0-index
        }
      }

      if (validationErrors.length > 0) {
        setUploadWarnings(prev => [...prev, ...validationErrors]);
        if (validationErrors.length === parsedShots.length) {
          setUploadResult({ success: false, message: 'All shots failed validation. Please check your data.' });
          return;
        }
      }

      // Filter out invalid shots
      const validShots = parsedShots.filter((shot, i) => {
        return !validationErrors.some(e => e.row === i + 2);
      });

      // If replace mode, delete existing data first
      if (replaceAll) {
        const { error: deleteError } = await supabase.from('shots').delete().eq('user_id', user?.id);
        if (deleteError) {
          setUploadResult({ success: false, message: getUserFriendlyError(deleteError) });
          return;
        }
      }

      // Transform valid shots to database format - include user_id
      const dbShots = validShots.map(shot => ({
        club: (/^[0-9]+[a-zA-Z]$/.test(shot.club.trim()) ? shot.club.trim().toUpperCase() : shot.club).substring(0, 10), // Normalize codes like 6i -> 6I
        shot_type: shot.type,
        target: Math.max(0, Math.min(600, shot.target)), // Clamp values
        total: Math.max(0, Math.min(600, shot.total)),
        offline: Math.max(-200, Math.min(200, shot.side)),
        start_lie: shot.startLie,
        end_lie: shot.endLie,
        strike_quality: shot.strikeQuality,
        shot_quality: shot.shotQuality,
        end_distance_from_target: shot.endDistanceFromTarget !== undefined 
          ? Math.max(0, Math.min(600, shot.endDistanceFromTarget)) 
          : null,
        notes: shot.notes,
        shot_date: getShotDateKey(shot.date),
        user_id: user?.id,
      }));

      // Insert in batches of 100
      const batchSize = 100;
      let insertedCount = 0;
      
      for (let i = 0; i < dbShots.length; i += batchSize) {
        const batch = dbShots.slice(i, i + batchSize);
        const { error } = await supabase.from('shots').insert(batch);
        
        if (error) {
          setUploadResult({ 
            success: false, 
            message: getUserFriendlyError(error)
          });
          return;
        }
        insertedCount += batch.length;
      }

      const skippedCount = parsedShots.length - validShots.length;
      const skippedMsg = skippedCount > 0 ? ` (${skippedCount} invalid shots skipped)` : '';
      
      setUploadResult({ 
        success: true, 
        message: `Successfully ${replaceAll ? 'replaced with' : 'added'} ${insertedCount} shots.${skippedMsg}` 
      });
      
      // Refresh the shots data
      await refreshShots();

    } catch (error) {
      setUploadResult({ 
        success: false, 
        message: getUserFriendlyError(error)
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete ALL shot data? This cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    setUploadResult(null);

    try {
      const { error } = await supabase.from('shots').delete().eq('user_id', user?.id);
      
      if (error) {
        setUploadResult({ success: false, message: getUserFriendlyError(error) });
      } else {
        setUploadResult({ success: true, message: 'All shot data has been deleted.' });
        await refreshShots();
      }
    } catch (error) {
      setUploadResult({ 
        success: false, 
        message: getUserFriendlyError(error)
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteLastUpload = async () => {
    setIsDeleting(true);
    setUploadResult(null);
    try {
      const { data: latest, error: latestErr } = await supabase
        .from('shots')
        .select('created_at')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (latestErr || !latest || latest.length === 0) {
        setUploadResult({ success: false, message: 'No uploads found to delete.' });
        return;
      }

      const latestTs = latest[0].created_at as string;
      // 5-second window to capture the whole batch insert
      const start = new Date(new Date(latestTs).getTime() - 5000).toISOString();
      const end = new Date(new Date(latestTs).getTime() + 5000).toISOString();

      const { count, error: countErr } = await supabase
        .from('shots')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .gte('created_at', start)
        .lte('created_at', end);

      if (countErr) {
        setUploadResult({ success: false, message: getUserFriendlyError(countErr) });
        return;
      }

      if (!confirm(`Delete ${count ?? '?'} rows from the last upload (${new Date(latestTs).toLocaleString()})? This cannot be undone.`)) {
        return;
      }

      const { error } = await supabase
        .from('shots')
        .delete()
        .eq('user_id', user?.id)
        .gte('created_at', start)
        .lte('created_at', end);

      if (error) {
        setUploadResult({ success: false, message: getUserFriendlyError(error) });
      } else {
        setUploadResult({ success: true, message: `Deleted ${count ?? ''} rows from the last upload.` });
        await refreshShots();
      }
    } catch (error) {
      setUploadResult({ success: false, message: getUserFriendlyError(error) });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Data Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Current Data
          </CardTitle>
          <CardDescription>
            You currently have {shots.length} shots in the database.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleDeleteLastUpload}
            disabled={isDeleting || shots.length === 0}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? 'Deleting...' : 'Delete Last Upload'}
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDeleteAll}
            disabled={isDeleting || shots.length === 0}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? 'Deleting...' : 'Delete All Data'}
          </Button>
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Shot Data
          </CardTitle>
          <CardDescription>
            Upload a CSV file with your shot data. Data will be appended by default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Replace toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="replace-mode"
              checked={replaceAll}
              onCheckedChange={setReplaceAll}
            />
            <Label htmlFor="replace-mode">
              Replace all existing data (instead of appending)
            </Label>
          </div>

          {/* Drag and drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragOver 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-upload"
            />
            <Upload className={`h-10 w-10 mx-auto mb-3 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="text-sm font-medium">
              {isUploading ? 'Uploading...' : 'Drag and drop your CSV file here'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              or click to browse
            </p>
          </div>

          {/* Result message */}
          {uploadResult && (
            <Alert variant={uploadResult.success ? 'default' : 'destructive'}>
              {uploadResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{uploadResult.message}</AlertDescription>
            </Alert>
          )}

          {/* Warnings for rows with issues */}
          {uploadWarnings.length > 0 && (
            <Alert variant="default" className="border-yellow-500/50 bg-yellow-500/10">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription>
                <p className="font-medium mb-2">{uploadWarnings.length} row(s) had issues:</p>
                <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                  {uploadWarnings.slice(0, 10).map((w, i) => (
                    <li key={i}>Row {w.row}: {w.issue}</li>
                  ))}
                  {uploadWarnings.length > 10 && (
                    <li className="text-muted-foreground">...and {uploadWarnings.length - 10} more</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* CSV Format Info */}
          <div className="text-sm text-muted-foreground border-t pt-4 mt-4">
            <p className="font-medium mb-2">Expected CSV format:</p>
            <code className="block bg-muted p-2 rounded text-xs">
              Date, Club, Type, Start Lie, End Lie, Strike Quality, Shot Quality, Target, End Distance from Target, Distance Hit, Dispersion
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
