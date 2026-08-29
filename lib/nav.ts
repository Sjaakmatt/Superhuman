export type NavItem = {
  href: string;
  label: string;
  title: string;
  /** Eén pad, met de hand getekend op een 24x24 raster. Geen icoonbibliotheek. */
  icon: string;
};

export const NAV: NavItem[] = [
  { href: '/', label: 'Vandaag', title: 'Vandaag', icon: 'M4 12l8-7 8 7M6 11v8h12v-8' },
  { href: '/loggen', label: 'Loggen', title: 'Loggen', icon: 'M5 4h11l3 3v13H5zM9 12h7M9 16h5M9 8h4' },
  { href: '/kracht', label: 'Kracht', title: 'Kracht', icon: 'M4 9v6M8 7v10M16 7v10M20 9v6M8 12h8' },
  { href: '/analyse', label: 'Analyse', title: 'Analyse', icon: 'M4 19V5M4 19h16M8 16V9M12 16v-4M16 16v-8' },
  { href: '/seizoen', label: 'Seizoen', title: 'Seizoen', icon: 'M4 6h16M4 12h16M4 18h16M9 3v18M15 3v18' },
];

/** Schermen buiten de hoofdnavigatie hebben ook een titel nodig in de kop. */
export const EXTRA_TITLES: Record<string, string> = {
  '/instellingen': 'Instellingen',
  '/login': 'Inloggen',
  '/offline': 'Geen verbinding',
};
