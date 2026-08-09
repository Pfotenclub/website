import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ url }) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID ?? '',
    redirect_uri: process.env.DISCORD_REDIRECT_URI ?? '',
    response_type: 'code',
    scope: 'identify guilds guilds.members.read',
  });

  return new Response(null, {
    status: 302,
    headers: { Location: `https://discord.com/api/oauth2/authorize?${params}` },
  });
};
