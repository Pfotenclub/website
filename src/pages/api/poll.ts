import type { APIRoute } from 'astro';
import { verifySessionCookie, SESSION_COOKIE } from '../../lib/session';

const SNOWFLAKE_RE = /^\d{15,25}$/;

interface PollAnswer {
  text: string;
  emoji?: string;
}

interface PollBody {
  channelId: string;
  question: string;
  answers: Array<string | PollAnswer>;
  duration?: number;
  allowMultiselect?: boolean;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const sessionCookie = cookies.get(SESSION_COOKIE)?.value;
  const session = sessionCookie
    ? verifySessionCookie(sessionCookie, process.env.SESSION_SECRET ?? '')
    : null;

  if (!session?.isBurgeramt) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const apiUrl = process.env.FABAXI_API_URL;
  const apiKey = process.env.FABAXI_API_KEY;

  if (!apiUrl || !apiKey) {
    console.error('[poll] Missing FABAXI_API_URL or FABAXI_API_KEY');
    return new Response(JSON.stringify({ error: 'Not configured' }), { status: 500 });
  }

  let body: PollBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  const channelId = body.channelId?.trim() ?? '';
  const question = body.question?.trim() ?? '';
  const answers = Array.isArray(body.answers) ? body.answers : [];

  if (!SNOWFLAKE_RE.test(channelId)) {
    return new Response(JSON.stringify({ error: 'Invalid channel ID' }), { status: 400 });
  }
  if (!question || question.length > 300) {
    return new Response(JSON.stringify({ error: 'Invalid question' }), { status: 400 });
  }
  if (answers.length < 2 || answers.length > 10) {
    return new Response(JSON.stringify({ error: 'Poll needs between 2 and 10 answers' }), { status: 400 });
  }
  const validAnswers = answers.every((a) =>
    typeof a === 'string' ? a.trim().length > 0 : typeof a?.text === 'string' && a.text.trim().length > 0,
  );
  if (!validAnswers) {
    return new Response(JSON.stringify({ error: 'Invalid answers' }), { status: 400 });
  }
  if (body.duration !== undefined && (typeof body.duration !== 'number' || body.duration < 1 || body.duration > 768)) {
    return new Response(JSON.stringify({ error: 'Invalid duration' }), { status: 400 });
  }

  const extraFields = [
    body.duration !== undefined ? `,"duration":${body.duration}` : '',
    body.allowMultiselect !== undefined ? `,"allow_multiselect":${!!body.allowMultiselect}` : '',
  ].join('');

  let res: Response;
  try {
    res = await fetch(`${apiUrl}/api/poll`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      // channel_id als rohen Zahlenwert ohne parseInt einbauen,
      // da Discord-IDs 64-bit sind und JS-Number Präzision verliert
      body: `{"channel_id":${channelId},"question":${JSON.stringify(question)},"answers":${JSON.stringify(answers)}${extraFields}}`,
    });
  } catch (err) {
    console.error('[poll] Fabaxi API nicht erreichbar:', err);
    return new Response(JSON.stringify({ error: 'Bot nicht erreichbar' }), { status: 502 });
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`[poll] Fabaxi API Fehler ${res.status}: ${text}`);
    return new Response(JSON.stringify({ error: 'Bot API Fehler' }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
