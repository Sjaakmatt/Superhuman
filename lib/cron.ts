/** Cron-routes zijn openbaar bereikbaar, dus ze controleren een geheim.
 *  Vercel stuurt CRON_SECRET mee als `Authorization: Bearer <waarde>`. */
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}
