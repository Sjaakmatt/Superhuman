import Shell from '@/components/Shell';
import { getAthlete } from '@/lib/data';
import { currentEmail } from '@/lib/db';

/** De schil met zijbalk, navigatie en zoekbalk hoort alleen bij de app zelf.
 *  De inlogschermen staan bewust buiten deze groep: daar valt niets te
 *  navigeren en hoort ook niets van je gegevens zichtbaar te zijn. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [athlete, email] = await Promise.all([getAthlete(), currentEmail()]);
  const naam = athlete?.name?.trim() || null;
  // De letter in de hoek: je naam, anders je mailadres, anders niets.
  const initiaal = (naam ?? email ?? '').trim().charAt(0).toUpperCase() || '·';

  return <Shell naam={naam} initiaal={initiaal}>{children}</Shell>;
}
