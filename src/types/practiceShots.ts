// Individual practice shot data stored in database
export interface PracticeShotData {
  id: string;
  sessionId: string;
  shotNumber: number;
  excluded: boolean;
  metrics: PracticeShotMetrics;
  createdAt: Date;
  updatedAt: Date;
}

// Shot-level metrics (raw values from spreadsheet)
export interface PracticeShotMetrics {
  tempo?: string;
  carry: number;
  total: number;
  ballSpeed: number;
  height: number;
  launchAngle: number;
  launchDirection: number;
  carrySide: number;
  backswingTime: number;
  downswingTime: number;
  attackAngle: number;
  swingSpeed: number;
  peakHandSpeed: number;
}

// For creating new shots (without id)
export type NewPracticeShot = Omit<PracticeShotData, 'id' | 'createdAt' | 'updatedAt'>;
