import ExcelJS from 'exceljs';
import { PracticeMetricValue } from '@/types/practice';

export interface PracticeShot {
  shotNumber: number;
  tempo: string;
  carry: number;
  total: number;
  ballSpeed: number;
  height: number;
  launchAngle: number;
  launchDirection: number; // Positive = Right, Negative = Left
  carrySide: number; // Positive = Right, Negative = Left (lateral miss)
  backswingTime: number;
  downswingTime: number;
  attackAngle: number;
  swingSpeed: number;
  peakHandSpeed: number;
}

export interface CalculatedMetrics {
  metrics: Record<string, PracticeMetricValue>;
  consistency: {
    distanceCount: number;
    lateralCount: number;
    bestCount: number;
    totalShots: number;
    distancePct: number;
    lateralPct: number;
    bestPct: number;
    overallScore: number;
  };
  notes: string;
}

// Parse direction strings like "6.2R", "5.5L", "1.2L" to numbers (positive = right, negative = left)
function parseDirection(value: string | number): number {
  if (typeof value === 'number') return value;
  const str = String(value).trim();
  const match = str.match(/^([\d.]+)\s*([LR])?$/i);
  if (match) {
    const num = parseFloat(match[1]);
    const dir = match[2]?.toUpperCase();
    return dir === 'L' ? -num : num;
  }
  return parseFloat(str) || 0;
}

// Parse tempo ratio like "2.8:1" to just the ratio number
function parseTempoRatio(value: string | number): number {
  if (typeof value === 'number') return value;
  const str = String(value).trim();
  const match = str.match(/^([\d.]+):1$/);
  if (match) return parseFloat(match[1]);
  return parseFloat(str) || 0;
}

// Parse angle values that might be formatted with unicode minus characters or text suffixes
// Examples: "−8.2", "–11.3", "—9", "8 down", "8D", "-8°"
function parseAngle(value: string | number): number {
  if (typeof value === 'number') return value;

  const original = String(value).trim();
  if (!original) return 0;

  // If the source uses words/letters to indicate "down", treat as negative
  const impliesNegative = /\b(down|dn)\b/i.test(original) || /\d\s*d\s*$/i.test(original);

  // Normalize common unicode minus/dash characters to ASCII hyphen-minus
  const normalized = original
    .normalize('NFKC')
    .replace(/[\u2212\u2013\u2014\u2012\u2010\u2011]/g, '-')
    .replace(/°/g, '')
    .replace(/\b(down|dn)\b/gi, '')
    .trim();

  // Extract first signed number
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;

  const num = parseFloat(match[0]);
  if (Number.isNaN(num)) return 0;

  return impliesNegative ? -Math.abs(num) : num;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function getExcelCellPrimitive(value: ExcelJS.CellValue | null | undefined): unknown {
  if (value == null) return '';

  // Formula cell
  if (typeof value === 'object' && 'formula' in value) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (value as any).result ?? '';
  }

  // Rich text
  if (typeof value === 'object' && 'richText' in value) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rt = (value as any).richText as Array<{ text: string }>;
    return rt?.map((x) => x.text).join('') ?? '';
  }

  // Hyperlink
  if (typeof value === 'object' && 'text' in value && 'hyperlink' in value) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (value as any).text ?? '';
  }

  // Date
  if (value instanceof Date) return value.toISOString();

  return value;
}

export async function parseSpreadsheet(file: File): Promise<PracticeShot[]> {
  // NOTE: exceljs supports .xlsx. If users upload .xls, this will fail.
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  // Build header map from first row
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = normalizeHeader(getExcelCellPrimitive(cell.value));
  });

  const rows: Record<string, unknown>[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const obj: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber - 1];
      if (!key) return;
      obj[key] = getExcelCellPrimitive(cell.value);
    });

    // Ignore completely empty rows
    if (Object.keys(obj).length > 0) rows.push(obj);
  });

  // Normalize header for tolerant matching: lowercase, strip units/parens/symbols, collapse spaces
  const normalizeKey = (s: string): string =>
    s
      .toLowerCase()
      .replace(/\(.*?\)/g, ' ')      // strip "(m)", "(°)", "(km/h)", "(s)"
      .replace(/[°#:_\-/]/g, ' ')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const buildIndex = (row: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(row)) {
      const nk = normalizeKey(k);
      if (nk && out[nk] === undefined) out[nk] = row[k];
    }
    return out;
  };

  const shots: PracticeShot[] = rows.map((row, index) => {
    const idx = buildIndex(row);

    const getVal = (aliases: string[]): unknown => {
      const norm = aliases.map(normalizeKey).filter(Boolean);
      // 1) exact normalized match
      for (const a of norm) {
        if (idx[a] !== undefined && idx[a] !== '') return idx[a];
      }
      // 2) all-words-present match (handles extra qualifiers in header)
      for (const a of norm) {
        const words = a.split(' ');
        for (const k of Object.keys(idx)) {
          const kw = k.split(' ');
          if (words.every(w => kw.includes(w)) && idx[k] !== undefined && idx[k] !== '') {
            return idx[k];
          }
        }
      }
      return '';
    };

    const toNum = (v: unknown): number => {
      if (v === '' || v == null) return 0;
      if (typeof v === 'number') return v;
      const n = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
      return Number.isNaN(n) ? 0 : n;
    };

    return {
      shotNumber: toNum(getVal(['Shot #', 'Shot', 'Shot Number'])) || index + 1,
      tempo: String(getVal(['Tempo Ratio', 'Swing Tempo', 'Tempo']) || ''),
      carry: toNum(getVal(['Carry (m)', 'Carry'])),
      total: toNum(getVal(['Total (m)', 'Total', 'Total Distance'])),
      ballSpeed: toNum(getVal(['Ball Speed (km/h)', 'Ball Speed'])),
      height: toNum(getVal(['Height (m)', 'Peak Height', 'Height', 'Apex'])),
      launchAngle: toNum(getVal(['Launch Angle (°)', 'Launch Angle', 'Launch (°)', 'Launch'])),
      launchDirection: parseDirection(getVal(['Launch Dir (°)', 'Launch Direction', 'Launch Dir']) as string),
      carrySide: parseDirection(getVal(['Carry Side (m)', 'Carry Side', 'Lateral', 'Side']) as string),
      backswingTime: toNum(getVal(['Backswing Time (s)', 'Back (s)', 'Backswing'])),
      downswingTime: toNum(getVal(['Downswing Time (s)', 'Down (s)', 'Downswing'])),
      attackAngle: parseAngle(getVal(['Attack Angle (°)', 'Attack (°)', 'Attack Angle', 'Attack']) as string | number),
      swingSpeed: toNum(getVal(['Swing Speed (km/h)', 'Swing Speed', 'Club Speed'])),
      peakHandSpeed: toNum(getVal(['Peak Hand Speed (km/h)', 'Peak Hand Speed', 'Hand Speed'])),
    };
  });

  return shots;
}

export function calculateMetricsFromShots(
  shots: PracticeShot[],
  distanceTargetMin: number = 145,
  lateralTargetMax: number = 10
): CalculatedMetrics {
  if (shots.length === 0) {
    return {
      metrics: {},
      consistency: {
        distanceCount: 0,
        lateralCount: 0,
        bestCount: 0,
        totalShots: 0,
        distancePct: 0,
        lateralPct: 0,
        bestPct: 0,
        overallScore: 0,
      },
      notes: '',
    };
  }

  const totalShots = shots.length;

  // Extract arrays for calculations
  const carries = shots.map(s => s.carry);
  const totals = shots.map(s => s.total);
  const ballSpeeds = shots.map(s => s.ballSpeed);
  const heights = shots.map(s => s.height);
  const launchAngles = shots.map(s => s.launchAngle);
  const launchDirs = shots.map(s => s.launchDirection);
  const lateralMisses = shots.map(s => Math.abs(s.carrySide));
  const backswingTimes = shots.map(s => s.backswingTime);
  const downswingTimes = shots.map(s => s.downswingTime);
  const attackAngles = shots.map(s => s.attackAngle);
  const swingSpeeds = shots.map(s => s.swingSpeed);
  const peakHandSpeeds = shots.map(s => s.peakHandSpeed);
  const tempoRatios = shots.map(s => parseTempoRatio(s.tempo));

  // Helper functions
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const min = (arr: number[]) => Math.min(...arr);
  const max = (arr: number[]) => Math.max(...arr);
  const round = (n: number, decimals: number = 1) => Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);

  // Calculate roll for each shot
  const rolls = shots.map(s => s.total - s.carry);

  // Calculate bias direction
  const avgCarrySide = avg(shots.map(s => s.carrySide));
  let biasDirection = 'Neutral';
  if (avgCarrySide > 5) biasDirection = 'Right bias';
  else if (avgCarrySide < -5) biasDirection = 'Left bias';
  else if (avgCarrySide > 2) biasDirection = 'Slight right';
  else if (avgCarrySide < -2) biasDirection = 'Slight left';

  // Consistency calculations
  const distanceCount = shots.filter(s => s.total >= distanceTargetMin).length;
  const lateralCount = shots.filter(s => Math.abs(s.carrySide) <= lateralTargetMax).length;
  const bestCount = shots.filter(s => s.total >= distanceTargetMin && Math.abs(s.carrySide) <= lateralTargetMax).length;

  const distancePct = round((distanceCount / totalShots) * 100, 1);
  const lateralPct = round((lateralCount / totalShots) * 100, 1);
  const bestPct = round((bestCount / totalShots) * 100, 1);
  const overallScore = round((distancePct + lateralPct + bestPct) / 3, 1);

  // Format direction for display
  const formatDir = (val: number) => {
    const absVal = Math.abs(val);
    if (val >= 0) return `${round(absVal)}R`;
    return `${round(absVal)}L`;
  };

  // Build metrics object
  const metrics: Record<string, PracticeMetricValue> = {
    carry: {
      metricId: 'carry',
      valueMin: round(avg(carries)),
      valueMax: round(avg(carries)),
      valueDisplay: String(round(avg(carries))),
    },
    roll: {
      metricId: 'roll',
      valueMin: round(avg(rolls)),
      valueMax: round(avg(rolls)),
      valueDisplay: String(round(avg(rolls))),
    },
    total_distance: {
      metricId: 'total_distance',
      valueMin: round(avg(totals)),
      valueMax: round(avg(totals)),
      valueDisplay: String(round(avg(totals))),
    },
    furthest_total: {
      metricId: 'furthest_total',
      valueMin: max(totals),
      valueMax: max(totals),
      valueDisplay: String(max(totals)),
    },
    shortest_total: {
      metricId: 'shortest_total',
      valueMin: min(totals),
      valueMax: min(totals),
      valueDisplay: String(min(totals)),
    },
    carry_variation: {
      metricId: 'carry_variation',
      valueMin: max(carries) - min(carries),
      valueMax: max(carries) - min(carries),
      valueDisplay: String(max(carries) - min(carries)),
    },
    total_variation: {
      metricId: 'total_variation',
      valueMin: max(totals) - min(totals),
      valueMax: max(totals) - min(totals),
      valueDisplay: String(max(totals) - min(totals)),
    },
    ball_speed: {
      metricId: 'ball_speed',
      valueMin: min(ballSpeeds),
      valueMax: max(ballSpeeds),
      valueDisplay: `${min(ballSpeeds)}–${max(ballSpeeds)}`,
    },
    peak_height: {
      metricId: 'peak_height',
      valueMin: min(heights),
      valueMax: max(heights),
      valueDisplay: `${min(heights)}–${max(heights)}`,
    },
    launch_angle: {
      metricId: 'launch_angle',
      valueMin: round(min(launchAngles)),
      valueMax: round(max(launchAngles)),
      valueDisplay: `${round(min(launchAngles))}–${round(max(launchAngles))}`,
    },
    launch_direction: {
      metricId: 'launch_direction',
      valueMin: min(launchDirs),
      valueMax: max(launchDirs),
      valueDisplay: `${formatDir(min(launchDirs))}–${formatDir(max(launchDirs))}`,
    },
    avg_lateral_miss: {
      metricId: 'avg_lateral_miss',
      valueMin: round(avg(lateralMisses)),
      valueMax: round(avg(lateralMisses)),
      valueDisplay: String(round(avg(lateralMisses))),
    },
    bias_direction: {
      metricId: 'bias_direction',
      valueMin: null,
      valueMax: null,
      valueDisplay: biasDirection,
    },
    attack_angle: {
      metricId: 'attack_angle',
      valueMin: round(min(attackAngles)),
      valueMax: round(max(attackAngles)),
      valueDisplay: `${round(min(attackAngles))} to ${round(max(attackAngles))}`,
    },
    swing_speed: {
      metricId: 'swing_speed',
      valueMin: min(swingSpeeds),
      valueMax: max(swingSpeeds),
      valueDisplay: `${min(swingSpeeds)}–${max(swingSpeeds)}`,
    },
    peak_hand_speed: {
      metricId: 'peak_hand_speed',
      valueMin: round(min(peakHandSpeeds)),
      valueMax: round(max(peakHandSpeeds)),
      valueDisplay: `${round(min(peakHandSpeeds))}–${round(max(peakHandSpeeds))}`,
    },
    smash_factor: {
      metricId: 'smash_factor',
      valueMin: round(min(shots.map(s => s.swingSpeed > 0 ? s.ballSpeed / s.swingSpeed : 0).filter(v => v > 0)), 2),
      valueMax: round(max(shots.map(s => s.swingSpeed > 0 ? s.ballSpeed / s.swingSpeed : 0).filter(v => v > 0)), 2),
      valueDisplay: (() => {
        const smashFactors = shots.map(s => s.swingSpeed > 0 ? s.ballSpeed / s.swingSpeed : 0).filter(v => v > 0);
        if (smashFactors.length === 0) return '–';
        const minSF = round(min(smashFactors), 2);
        const maxSF = round(max(smashFactors), 2);
        return minSF === maxSF ? String(minSF) : `${minSF}–${maxSF}`;
      })(),
    },
    backswing_time: {
      metricId: 'backswing_time',
      valueMin: round(min(backswingTimes), 2),
      valueMax: round(max(backswingTimes), 2),
      valueDisplay: `${round(min(backswingTimes), 2)}–${round(max(backswingTimes), 2)}`,
    },
    downswing_time: {
      metricId: 'downswing_time',
      valueMin: round(min(downswingTimes), 2),
      valueMax: round(max(downswingTimes), 2),
      valueDisplay: `${round(min(downswingTimes), 2)}–${round(max(downswingTimes), 2)}`,
    },
    tempo_ratio: {
      metricId: 'tempo_ratio',
      valueMin: round(min(tempoRatios), 1),
      valueMax: round(max(tempoRatios), 1),
      valueDisplay: `${round(min(tempoRatios), 1)}–${round(max(tempoRatios), 1)}`,
    },
  };

  // Generate auto notes
  const notes = `${totalShots} shots. Carry variation ${max(carries) - min(carries)}m. ${biasDirection}. Consistency: ${overallScore}% (${bestCount}/${totalShots} best shots).`;

  return {
    metrics,
    consistency: {
      distanceCount,
      lateralCount,
      bestCount,
      totalShots,
      distancePct,
      lateralPct,
      bestPct,
      overallScore,
    },
    notes,
  };
}
