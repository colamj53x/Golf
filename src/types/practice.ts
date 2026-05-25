export type MetricStatus = 'green' | 'amber' | 'red';
export type DirectionArrow = '→' | '↑' | '↓' | '';

export interface PracticeMetricTarget {
  id: string;
  metricName: string;
  targetMin: number | null;
  targetMax: number | null;
  targetDisplay: string; // e.g., "120-125", "≤10", "3.0 : 1"
  unit: string; // e.g., "m", "°", "km/h", "s", ": 1"
  higherIsBetter: boolean; // For determining status color
  category: 'distance' | 'ball_flight' | 'dispersion' | 'swing' | 'tempo';
}

export interface PracticeMetricValue {
  metricId: string;
  valueMin: number | null;
  valueMax: number | null;
  valueDisplay: string; // e.g., "125", "175-185", "-9 to -13"
}

export interface ConsistencyData {
  distanceCount: number;
  lateralCount: number;
  bestCount: number;
  totalShots: number;
  distancePct: number;
  lateralPct: number;
  bestPct: number;
  overallScore: number;
}

export interface PracticeSession {
  id: string;
  clubId: string;
  date: Date;
  metrics: PracticeMetricValue[];
  notes: string;
  consistency?: ConsistencyData;
}

export interface PracticeMetricResult extends PracticeMetricTarget {
  actual: PracticeMetricValue | null;
  status: MetricStatus;
  direction: DirectionArrow;
  commentary: string;
  tips: string;
}

export interface ClubPracticeConfig {
  clubId: string;
  clubName: string;
  metrics: PracticeMetricTarget[];
}

// Default 4H practice metrics based on the document
export const DEFAULT_4H_PRACTICE_METRICS: PracticeMetricTarget[] = [
  // Distance metrics
  {
    id: 'carry',
    metricName: 'Carry',
    targetMin: 120,
    targetMax: 125,
    targetDisplay: '120–125',
    unit: 'm',
    higherIsBetter: true,
    category: 'distance',
  },
  {
    id: 'roll',
    metricName: 'Roll',
    targetMin: null,
    targetMax: null,
    targetDisplay: '–',
    unit: 'm',
    higherIsBetter: true,
    category: 'distance',
  },
  {
    id: 'total_distance',
    metricName: 'Total Distance',
    targetMin: 145,
    targetMax: 150,
    targetDisplay: '145–150',
    unit: 'm',
    higherIsBetter: true,
    category: 'distance',
  },
  {
    id: 'furthest_total',
    metricName: 'Furthest Total',
    targetMin: null,
    targetMax: null,
    targetDisplay: '–',
    unit: 'm',
    higherIsBetter: true,
    category: 'distance',
  },
  {
    id: 'shortest_total',
    metricName: 'Shortest Total',
    targetMin: null,
    targetMax: null,
    targetDisplay: '–',
    unit: 'm',
    higherIsBetter: false,
    category: 'distance',
  },
  {
    id: 'carry_variation',
    metricName: 'Carry Variation',
    targetMin: null,
    targetMax: 10,
    targetDisplay: '≤10',
    unit: 'm',
    higherIsBetter: false,
    category: 'distance',
  },
  {
    id: 'total_variation',
    metricName: 'Total Variation',
    targetMin: null,
    targetMax: 15,
    targetDisplay: '≤15',
    unit: 'm',
    higherIsBetter: false,
    category: 'distance',
  },
  // Ball flight metrics (range-based: store min-max)
  {
    id: 'ball_speed',
    metricName: 'Ball Speed',
    targetMin: 175,
    targetMax: 185,
    targetDisplay: '175–185',
    unit: 'km/h',
    higherIsBetter: true,
    category: 'ball_flight',
  },
  {
    id: 'peak_height',
    metricName: 'Peak Height',
    targetMin: 12,
    targetMax: 14,
    targetDisplay: '12–14',
    unit: 'm',
    higherIsBetter: false,
    category: 'ball_flight',
  },
  {
    id: 'launch_angle',
    metricName: 'Launch Angle',
    targetMin: 13,
    targetMax: 15,
    targetDisplay: '13–15',
    unit: '°',
    higherIsBetter: false,
    category: 'ball_flight',
  },
  {
    id: 'launch_direction',
    metricName: 'Launch Direction',
    targetMin: 1,
    targetMax: 4,
    targetDisplay: '1–4R',
    unit: '°',
    higherIsBetter: false,
    category: 'ball_flight',
  },
  // Dispersion metrics
  {
    id: 'avg_lateral_miss',
    metricName: 'Avg Lateral Miss',
    targetMin: null,
    targetMax: 10,
    targetDisplay: '≤10',
    unit: 'm',
    higherIsBetter: false,
    category: 'dispersion',
  },
  {
    id: 'bias_direction',
    metricName: 'Bias Direction',
    targetMin: null,
    targetMax: null,
    targetDisplay: 'Neutral–fade',
    unit: '',
    higherIsBetter: false,
    category: 'dispersion',
  },
  // Swing metrics (range-based: store min-max)
  {
    id: 'attack_angle',
    metricName: 'Attack Angle',
    targetMin: -4,
    targetMax: -2,
    targetDisplay: '-2 to -4',
    unit: '°',
    higherIsBetter: false,
    category: 'swing',
  },
  {
    id: 'swing_speed',
    metricName: 'Swing Speed',
    targetMin: 118,
    targetMax: 125,
    targetDisplay: '118–125',
    unit: 'km/h',
    higherIsBetter: true,
    category: 'swing',
  },
  {
    id: 'peak_hand_speed',
    metricName: 'Peak Hand Speed',
    targetMin: 25,
    targetMax: 27,
    targetDisplay: '25–27',
    unit: 'km/h',
    higherIsBetter: true,
    category: 'swing',
  },
  {
    id: 'smash_factor',
    metricName: 'Smash Factor',
    targetMin: 1.45,
    targetMax: 1.50,
    targetDisplay: '1.45–1.50',
    unit: '',
    higherIsBetter: true,
    category: 'swing',
  },
  // Tempo metrics (range-based: store min-max)
  {
    id: 'backswing_time',
    metricName: 'Backswing Time',
    targetMin: 0.9,
    targetMax: 1.05,
    targetDisplay: '0.90–1.05',
    unit: 's',
    higherIsBetter: false,
    category: 'tempo',
  },
  {
    id: 'downswing_time',
    metricName: 'Downswing Time',
    targetMin: 0.3,
    targetMax: 0.35,
    targetDisplay: '0.30–0.35',
    unit: 's',
    higherIsBetter: false,
    category: 'tempo',
  },
  {
    id: 'tempo_ratio',
    metricName: 'Tempo Ratio',
    targetMin: 2.8,
    targetMax: 3.2,
    targetDisplay: '2.8–3.2',
    unit: ': 1',
    higherIsBetter: false,
    category: 'tempo',
  },
];
