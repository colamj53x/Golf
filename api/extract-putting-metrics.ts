const metricProperties = {
  tempo_ratio: { type: ['number', 'null'] },
  backstroke_time: { type: ['number', 'null'] },
  forwardstroke_time: { type: ['number', 'null'] },
  total_stroke_time: { type: ['number', 'null'] },
  tempo_consistency: { type: ['number', 'null'] },
  face_rotation: { type: ['number', 'null'] },
  lie_loft_change: { type: ['number', 'null'] },
  stroke_length: { type: ['number', 'null'] },
  extraction_confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  extraction_notes: { type: 'string' },
};

interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: { screenshots?: unknown };
}

interface ApiResponse {
  status: (status: number) => { json: (body: unknown) => void };
}

interface OpenAIContent {
  type?: string;
  text?: string;
}

interface OpenAIOutput {
  content?: OpenAIContent[];
}

interface OpenAIResponse {
  output_text?: string;
  output?: OpenAIOutput[];
}

function send(response: ApiResponse, status: number, body: unknown) {
  response.status(status).json(body);
}

async function isAuthenticated(token: string) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return false;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  return response.ok;
}

function outputText(response: OpenAIResponse): string {
  if (typeof response.output_text === 'string') return response.output_text;
  return response.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text || '';
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return send(response, 405, { error: 'Method not allowed.' });
  const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || !await isAuthenticated(token)) return send(response, 401, { error: 'Please sign in again.' });
  if (!process.env.OPENAI_API_KEY) return send(response, 503, { error: 'Screenshot reading is not configured yet.' });

  const screenshots = Array.isArray(request.body?.screenshots) ? request.body.screenshots : [];
  if (!screenshots.length || screenshots.length > 10) return send(response, 400, { error: 'Upload between 1 and 10 screenshots for one drill.' });
  if (screenshots.some((image: unknown) => typeof image !== 'string' || !image.startsWith('data:image/') || image.length > 3_000_000)) {
    return send(response, 400, { error: 'One of the screenshots is invalid or too large.' });
  }
  if (screenshots.reduce((total: number, image: string) => total + image.length, 0) > 4_000_000) {
    return send(response, 400, { error: 'This screenshot set is too large. Remove an image or upload a smaller set.' });
  }

  const prompt = `Read the Blast Motion putting metric screenshots together as one evidence set.
Extract only values visibly supported by the screenshots. Use null when a metric is absent or uncertain.
Do not calculate or invent missing values. Preserve the units shown by Blast Motion.
Use extraction_notes to state which metrics were not visible, ambiguous, or conflicting.
Set confidence to low if any visible metric is hard to read. Return JSON only.`;
  const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || 'gpt-5-mini',
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          ...screenshots.map((image_url: string) => ({ type: 'input_image', image_url, detail: 'high' })),
        ],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'blast_putting_metrics',
          strict: true,
          schema: {
            type: 'object',
            properties: metricProperties,
            required: Object.keys(metricProperties),
            additionalProperties: false,
          },
        },
      },
    }),
  });
  if (!openaiResponse.ok) return send(response, 502, { error: 'The screenshot reader could not process this evidence set.' });
  const body = await openaiResponse.json();
  try {
    return send(response, 200, { metrics: { ...JSON.parse(outputText(body)), extracted_at: new Date().toISOString() } });
  } catch {
    return send(response, 502, { error: 'The screenshot reader returned an incomplete result. Please try again.' });
  }
}
