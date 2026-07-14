import Link from "next/link";
import {
  Activity,
  Apple,
  Brain,
  Dumbbell,
  Heart,
  Target,
  type LucideIcon,
} from "lucide-react";
import { ATTRIBUTE_KEYS, ATTRIBUTES, type AttributeKey } from "@/lib/attributes";
import type { UserAttributeRow } from "@/lib/types";

const CELL_ICONS: Record<AttributeKey, LucideIcon> = {
  vitaliteit: Heart,
  kracht: Dumbbell,
  soepel: Activity,
  voeding: Apple,
  focus: Target,
  geest: Brain,
};

/** Waar voed je dit attribuut? Tik op een cel opent de juiste plek. */
const CELL_ROUTES: Record<AttributeKey, string> = {
  vitaliteit: "/vandaag",
  kracht: "/beweging",
  soepel: "/beweging/stretch",
  voeding: "/voeding",
  focus: "/vandaag",
  geest: "/geest",
};

const WILT_COLOR = "#E0748C";

interface MomentumCellsProps {
  attributes: Pick<UserAttributeRow, "key" | "level" | "momentum">[];
  /** Attributen die vandaag al gevoed zijn */
  fedToday: Set<AttributeKey>;
}

/** De zes momentum-cellen: gloed, pulssnelheid en status leven mee. */
export function MomentumCells({ attributes, fedToday }: MomentumCellsProps) {
  const byKey = new Map(attributes.map((a) => [a.key, a]));

  return (
    <ul className="grid grid-cols-3 gap-2.5">
      {ATTRIBUTE_KEYS.map((key) => {
        const def = ATTRIBUTES[key];
        const row = byKey.get(key);
        const momentum = Math.max(0, Math.min(100, row?.momentum ?? 50));
        const alive = momentum / 100;
        const wilting = momentum < 22;
        const fed = fedToday.has(key);
        const Icon = CELL_ICONS[key];

        const status = fed
          ? "vandaag gevoed +"
          : wilting
            ? "rust uit — voed het"
            : `momentum ${Math.round(momentum)}%`;

        return (
          <li key={key}>
            <Link
              href={CELL_ROUTES[key]}
              className="relative block overflow-hidden rounded-2xl border bg-card p-3 pb-2.5 transition-transform"
              style={{
                borderColor: fed ? def.colorVar : "var(--line)",
                boxShadow: fed
                  ? `0 0 0 1px ${def.colorVar}, 0 8px 26px color-mix(in srgb, ${def.colorVar} 20%, transparent)`
                  : undefined,
              }}
            >
              {/* Lading-gloed op de achtergrond */}
              <span
                aria-hidden
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(120% 90% at 20% 0%, color-mix(in srgb, ${def.colorVar} ${Math.round(24 * alive)}%, transparent), transparent 70%)`,
                  opacity: 0.5 + alive * 0.5,
                  transition: "opacity .6s",
                }}
              />
              <span className="relative block">
                <span className="flex items-center justify-between">
                  <span
                    className="flex size-8 items-center justify-center rounded-[10px] border"
                    style={{
                      background: `color-mix(in srgb, ${def.colorVar} 13%, transparent)`,
                      borderColor: `color-mix(in srgb, ${def.colorVar} 33%, transparent)`,
                      animation: `cell-pulse ${(3.4 - alive * 1.8).toFixed(2)}s ease-in-out infinite`,
                      filter: wilting ? "saturate(.5) brightness(.8)" : "none",
                      transition: "filter .6s",
                    }}
                  >
                    <Icon size={16} style={{ color: def.colorVar }} aria-hidden />
                  </span>
                  <span className="font-mono text-[11px] text-muted">
                    Lv{row?.level ?? 1}
                  </span>
                </span>
                <span className="mt-2 block text-[13px] font-semibold">
                  {def.label}
                </span>
                {/* Momentum-balk */}
                <span className="mt-1.5 block h-[5px] overflow-hidden rounded-full bg-ink-2">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${momentum}%`,
                      background: def.colorVar,
                      boxShadow: `0 0 8px ${def.colorVar}`,
                      transition: "width .7s cubic-bezier(.3,.8,.3,1)",
                    }}
                  />
                </span>
                <span
                  className="mt-1 block h-[13px] text-[10.5px]"
                  style={{ color: wilting && !fed ? WILT_COLOR : "var(--muted)" }}
                >
                  {status}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
