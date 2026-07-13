"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const NAV_ITEMS: NavItem[] = [
  {
    href: "/vandaag",
    label: "Vandaag",
    // De core: cirkel met kern
    icon: (
      <svg {...iconProps} aria-hidden>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: "/progressie",
    label: "Progressie",
    icon: (
      <svg {...iconProps} aria-hidden>
        <path d="M4 19V10" />
        <path d="M10 19V5" />
        <path d="M16 19v-6" />
        <path d="M22 19H2" />
      </svg>
    ),
  },
  {
    href: "/beweging",
    label: "Beweging",
    icon: (
      <svg {...iconProps} aria-hidden>
        <path d="M6.5 6.5v11" />
        <path d="M17.5 6.5v11" />
        <path d="M3.5 9v6" />
        <path d="M20.5 9v6" />
        <path d="M6.5 12h11" />
      </svg>
    ),
  },
  {
    href: "/voeding",
    label: "Voeding",
    icon: (
      <svg {...iconProps} aria-hidden>
        <path d="M12 21c-5 0-8-3.5-8-8 0-3 2-6 5-6 1.5 0 2.5.7 3 1.5.5-.8 1.5-1.5 3-1.5 3 0 5 3 5 6 0 4.5-3 8-8 8Z" />
        <path d="M12 8.5V6c0-1.5 1-2.5 2.5-3" />
      </svg>
    ),
  },
  {
    href: "/geest",
    label: "Geest",
    icon: (
      <svg {...iconProps} aria-hidden>
        <path d="M20 13.5A8.5 8.5 0 1 1 10.5 4a7 7 0 0 0 9.5 9.5Z" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-ink-2/95 backdrop-blur"
    >
      <ul className="mx-auto flex w-full max-w-md items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-[11px] transition-colors ${
                  active ? "text-text" : "text-muted hover:text-text"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
