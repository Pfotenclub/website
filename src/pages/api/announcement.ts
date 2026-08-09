import type { APIRoute } from 'astro';
import { verifySessionCookie, SESSION_COOKIE } from '../../lib/session';

const SNOWFLAKE_RE = /^\d{15,25}$/;

interface AnnouncementBody {
  channelId: string;
  content: string;
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
    console.error('[announcement] Missing FABAXI_API_URL or FABAXI_API_KEY');
    return new Response(JSON.stringify({ error: 'Not configured' }), { status: 500 });
  }

  let body: AnnouncementBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  const channelId = body.channelId?.trim() ?? '';
  const content = body.content?.trim() ?? '';

  if (!SNOWFLAKE_RE.test(channelId)) {
    return new Response(JSON.stringify({ error: 'Invalid channel ID' }), { status: 400 });
  }
  if (!content || content.length > 2000) {
    return new Response(JSON.stringify({ error: 'Invalid content' }), { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${apiUrl}/api/message`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      // channel_id als rohen Zahlenwert ohne parseInt einbauen,
      // da Discord-IDs 64-bit sind und JS-Number Präzision verliert
      body: `{"channel_id":${channelId},"content":${JSON.stringify(content)}}`,
    });
  } catch (err) {
    console.error('[announcement] Fabaxi API nicht erreichbar:', err);
    return new Response(JSON.stringify({ error: 'Bot nicht erreichbar' }), { status: 502 });
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`[announcement] Fabaxi API Fehler ${res.status}: ${text}`);
    return new Response(JSON.stringify({ error: 'Bot API Fehler' }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
