import type { ReactNode } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
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

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/vandaag",
    label: "Vandaag",
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
