import type { ReactNode } from 'react';
import { Card, CardTitle } from '@/components/ui';
import ThemeToggle from '@/components/ThemeToggle';

/** De schil om de drie inlogschermen. Smal, rustig, en zonder navigatie —
 *  hier hoor je één ding te doen. */
export default function AuthCard({
  title,
  intro,
  children,
  onder,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
  onder?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-[420px] flex-col gap-4">
        <div className="flex items-center gap-3 px-1">
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-[var(--r-btn)]"
            style={{ background: 'var(--acc)', color: 'var(--acc-ink)' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17l5-7 4 5 3-4 6 6" />
            </svg>
          </span>
          <span>
            <span className="block text-[15px] font-bold tracking-tight">Ultra100</span>
            <span className="block text-[12px]" style={{ color: 'var(--ink3)' }}>100 km — 2 oktober 2027</span>
          </span>
        </div>

        <Card>
          <CardTitle>{title}</CardTitle>
          {intro ? (
            <p className="mb-4 text-[14px] leading-relaxed" style={{ color: 'var(--ink2)' }}>{intro}</p>
          ) : null}
          {children}
        </Card>

        {onder ? <div className="px-1 text-[13px]" style={{ color: 'var(--ink3)' }}>{onder}</div> : null}

        <div className="px-1 pt-2"><ThemeToggle /></div>
      </div>
    </div>
  );
}
