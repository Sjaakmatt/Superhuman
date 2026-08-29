'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import CoachWidget from '@/components/CoachWidget';
import ThemeToggle from '@/components/ThemeToggle';
import PlanSearch from '@/components/PlanSearch';
import { EXTRA_TITLES, NAV, type NavItem } from '@/lib/nav';

const TAB_HREFS = ['/', '/loggen', '/kracht', '/analyse'];

function NavIcon({ item, className }: { item: NavItem; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d={item.icon} />
    </svg>
  );
}

function greeting(hour: number) {
  if (hour < 6) return 'Goedenacht';
  if (hour < 12) return 'Goedemorgen';
  if (hour < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

/** De naam komt uit de database, niet uit de code: er is meer dan één atleet.
 *  Zolang iemand hem niet heeft ingevuld groeten we zonder naam — beter dan de
 *  verkeerde naam, en beter dan een naam die uit een mailadres is geraden. */
export default function Shell({
  naam,
  initiaal,
  children,
}: {
  naam: string | null;
  initiaal: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [hello, setHello] = useState('Dag');

  // De klok van de bezoeker, dus pas na hydratie — anders wijkt de server af.
  useEffect(() => setHello(greeting(new Date().getHours())), []);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const tabs = NAV.filter((n) => TAB_HREFS.includes(n.href));

  return (
    <div className="min-h-dvh side:grid side:grid-cols-[264px_1fr]">
      {/* Zijbalk vanaf 1024px (Tailwind lg). Daaronder de tabbalk onderin. */}
      <aside className="hidden side:flex sticky top-0 h-dvh flex-col gap-1 px-4 py-6"
        style={{ background: 'var(--card)', borderRight: '1px solid var(--hair)' }}>
        <Link href="/" className="mb-6 flex items-center gap-3 px-3">
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-[var(--r-btn)]"
            style={{ background: 'var(--acc)', color: 'var(--acc-ink)' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17l5-7 4 5 3-4 6 6" />
            </svg>
          </span>
          <span>
            <span className="block text-[15px] font-bold tracking-tight">Ultra100</span>
            <span className="block text-[12px]" style={{ color: 'var(--ink3)' }}>2 okt 2027</span>
          </span>
        </Link>

        <nav className="flex flex-col gap-1" aria-label="Hoofdnavigatie">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
                className="interactive flex items-center gap-3 rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] font-medium"
                style={{
                  background: active ? 'var(--acc-soft)' : 'transparent',
                  color: active ? 'var(--acc)' : 'var(--ink2)',
                }}>
                <NavIcon item={item} className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <ThemeToggle />
          <Link href="/instellingen"
            className="interactive flex items-center gap-3 rounded-[var(--r-btn)] px-3 py-2.5"
            style={{ background: 'var(--card2)' }}>
            <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-pill)] text-[13px] font-bold"
              style={{ background: 'var(--acc)', color: 'var(--acc-ink)' }}>{initiaal}</span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold">{naam ?? 'Je account'}</span>
              <span className="block truncate text-[11px]" style={{ color: 'var(--ink3)' }}>Instellingen</span>
            </span>
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 px-4 py-3 side:px-8 side:py-5"
          style={{ background: 'color-mix(in srgb, var(--ground) 88%, transparent)', backdropFilter: 'blur(12px)' }}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px]" style={{ color: 'var(--ink3)' }}>{naam ? `${hello}, ${naam}` : hello}</p>
            <h1 className="truncate text-[19px] font-bold tracking-tight side:text-[22px]">
              {NAV.find((n) => isActive(n.href))?.title ?? EXTRA_TITLES[pathname] ?? 'Ultra100'}
            </h1>
          </div>
          <PlanSearch />
          <div className="side:hidden"><ThemeToggle compact /></div>
          {/* De zijbalk verschijnt pas vanaf 1040px, en daarin staan de
              instellingen. Zonder deze knop is er op de telefoon geen ingang. */}
          <Link href="/instellingen" aria-label="Instellingen"
            aria-current={pathname.startsWith('/instellingen') ? 'page' : undefined}
            className="interactive grid h-9 w-9 shrink-0 place-items-center rounded-[var(--r-pill)] text-[13px] font-bold side:hidden"
            style={{
              background: pathname.startsWith('/instellingen') ? 'var(--acc)' : 'var(--card2)',
              color: pathname.startsWith('/instellingen') ? 'var(--acc-ink)' : 'var(--ink2)',
              border: '1px solid var(--hair)',
            }}>
            {initiaal}
          </Link>
        </header>

        <main className="min-w-0 flex-1 px-4 pb-28 side:px-8 side:pb-12">{children}</main>
      </div>

      <nav aria-label="Hoofdnavigatie" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 gap-1 px-2 pt-2 side:hidden"
        style={{
          background: 'var(--card)',
          borderTop: '1px solid var(--hair)',
          paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        }}>
        {tabs.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center gap-1 rounded-[var(--r-btn)] py-1.5 text-[11px] font-medium"
              style={{ color: active ? 'var(--acc)' : 'var(--ink3)' }}>
              <NavIcon item={item} className="h-[21px] w-[21px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* De coach hangt over elk scherm heen en weet waar je stond toen je het
          vroeg. useSearchParams wil een Suspense-grens. */}
      <Suspense fallback={null}>
        <CoachWidget />
      </Suspense>
    </div>
  );
}
