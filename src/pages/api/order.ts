import type { APIRoute } from 'astro';
import { verifySessionCookie, SESSION_COOKIE } from '../../lib/session';

interface OrderBody {
  product: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  firstName: string;
  lastName: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  notes: string;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const sessionCookie = cookies.get(SESSION_COOKIE)?.value;
  const session = sessionCookie
    ? verifySessionCookie(sessionCookie, process.env.SESSION_SECRET ?? '')
    : null;

  if (!session?.isMember) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const apiUrl  = process.env.FABAXI_API_URL;
  const apiKey  = process.env.FABAXI_API_KEY;
  const adminId = process.env.DISCORD_ADMIN_USER_ID;

  if (!apiUrl || !apiKey || !adminId) {
    console.error('[order] Missing FABAXI_API_URL, FABAXI_API_KEY or DISCORD_ADMIN_USER_ID');
    return new Response(JSON.stringify({ error: 'Not configured' }), { status: 500 });
  }

  let body: OrderBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  const address = [
    `${body.firstName} ${body.lastName}`,
    body.street,
    `${body.zip} ${body.city}`,
    body.country,
  ].join('\n');

  const embed = {
    title: '🛒 Neue Bestellung',
    description: `Bestellung von **${session.username}**`,
    color: 5793266, // #5865F2
    fields: [
      { name: 'Produkt',    value: body.product,                     inline: true },
      { name: 'Farbe',      value: body.color,                       inline: true },
      { name: 'Größe',      value: body.size,                        inline: true },
      { name: 'Menge',      value: String(body.quantity),            inline: true },
      { name: 'Einzelpreis',value: `€${body.unitPrice.toFixed(2)}`,  inline: true },
      { name: 'Gesamt',     value: `€${body.totalPrice.toFixed(2)}`, inline: true },
      { name: '📦 Lieferadresse', value: `\`\`\`${address}\`\`\``,  inline: false },
      ...(body.notes ? [{ name: '📝 Anmerkungen', value: body.notes, inline: false }] : []),
    ],
    thumbnail_url: session.avatar
      ? `https://cdn.discordapp.com/avatars/${session.userId}/${session.avatar}.png?size=64`
      : undefined,
    footer: 'Pfotenclub Shop',
  };

  let res: Response;
  try {
    res = await fetch(`${apiUrl}/api/dm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      // user_id als rohen Zahlenwert ohne parseInt einbauen,
      // da Discord-IDs 64-bit sind und JS-Number Präzision verliert
      body: `{"user_id":${adminId},"embed":${JSON.stringify(embed)}}`,
    });
  } catch (err) {
    console.error('[order] Fabaxi API nicht erreichbar:', err);
    return new Response(JSON.stringify({ error: 'Bot nicht erreichbar' }), { status: 502 });
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`[order] Fabaxi API Fehler ${res.status}: ${text}`);
    return new Response(JSON.stringify({ error: 'Bot API Fehler' }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
