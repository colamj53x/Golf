import { supabase } from '@/integrations/supabase/client';
import type { PracticeShot } from '@/lib/practiceSpreadsheetParser';

export async function insertPracticeShots(
  userId: string,
  sessionId: string,
  shots: PracticeShot[],
): Promise<void> {
  if (shots.length === 0) return;

  const { error } = await supabase
    .from('practice_shots')
    .insert(shots.map((shot) => ({
      session_id: sessionId,
      shot_number: shot.shotNumber,
      excluded: false,
      metrics: JSON.parse(JSON.stringify({
        tempo: shot.tempo,
        carry: shot.carry,
        total: shot.total,
        ballSpeed: shot.ballSpeed,
        height: shot.height,
        launchAngle: shot.launchAngle,
        launchDirection: shot.launchDirection,
        carrySide: shot.carrySide,
        backswingTime: shot.backswingTime,
        downswingTime: shot.downswingTime,
        attackAngle: shot.attackAngle,
        swingSpeed: shot.swingSpeed,
        peakHandSpeed: shot.peakHandSpeed,
      })),
      user_id: userId,
    })));

  if (error) throw error;
}
