import Shell from '@/components/Shell';

/** De schil met zijbalk, navigatie en zoekbalk hoort alleen bij de app zelf.
 *  De inlogschermen staan bewust buiten deze groep: daar valt niets te
 *  navigeren en hoort ook niets van je gegevens zichtbaar te zijn. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
