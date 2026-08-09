import type { APIRoute } from 'astro';
import { createSessionCookie, SESSION_COOKIE } from '../../../lib/session';

const redirect = (url: URL | string) =>
  new Response(null, { status: 302, headers: { Location: String(url) } });

export const GET: APIRoute = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  if (!code) return redirect(new URL('/', url));

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID ?? '',
      client_secret: process.env.DISCORD_CLIENT_SECRET ?? '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI ?? '',
    }),
  });

  if (!tokenRes.ok) return redirect(new URL('/?auth=error', url));

  const { access_token } = await tokenRes.json() as { access_token: string };

  const [userRes, guildsRes, memberRes] = await Promise.all([
    fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    }),
    fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${access_token}` },
    }),
    fetch(`https://discord.com/api/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`, {
      headers: { Authorization: `Bearer ${access_token}` },
    }),
  ]);

  if (!userRes.ok) return redirect(new URL('/?auth=error', url));

  const user = await userRes.json() as {
    id: string;
    username: string;
    avatar: string | null;
  };

  const guilds: Array<{ id: string }> = guildsRes.ok ? await guildsRes.json() : [];
  const isMember = guilds.some((g) => g.id === process.env.DISCORD_GUILD_ID);

  let member: { roles: string[] } | null = null;
  if (memberRes.ok) {
    member = await memberRes.json() as { roles: string[] };
  } else {
    console.error(`[auth] Guild-Member-Abfrage fehlgeschlagen (${memberRes.status}): ${await memberRes.text()}`);
  }
  const isBurgeramt = !!member?.roles.includes(process.env.DISCORD_BURGERAMT_ROLE_ID ?? '');

  const sessionValue = createSessionCookie(
    { userId: user.id, username: user.username, avatar: user.avatar, isMember, isBurgeramt },
    process.env.SESSION_SECRET ?? '',
  );

  cookies.set(SESSION_COOKIE, sessionValue, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
  });

  return redirect(new URL('/shop', url));
};
