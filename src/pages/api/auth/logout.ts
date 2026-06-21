import type { APIRoute } from 'astro';
import { SESSION_COOKIE } from '../../../lib/session';

export const GET: APIRoute = ({ cookies, url }) => {
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return new Response(null, { status: 302, headers: { Location: new URL('/', url).href } });
};
