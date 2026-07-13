import { ATTRIBUTE_KEYS, ATTRIBUTES } from "@/lib/attributes";
import type { UserAttributeRow } from "@/lib/types";

const R = 22;
const CIRC = 2 * Math.PI * R;

interface AttributeRingsProps {
  attributes: Pick<UserAttributeRow, "key" | "level" | "xp" | "xp_max">[];
}

/** De zes attribuut-rings: XP-fractie als ring, level in het midden. */
export function AttributeRings({ attributes }: AttributeRingsProps) {
  const byKey = new Map(attributes.map((a) => [a.key, a]));

  return (
    <ul className="grid grid-cols-3 gap-3">
      {ATTRIBUTE_KEYS.map((key) => {
        const def = ATTRIBUTES[key];
        const row = byKey.get(key) ?? { key, level: 1, xp: 0, xp_max: 100 };
        const frac = Math.min(row.xp / row.xp_max, 1);

        return (
          <li
            key={key}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-card px-2 py-3"
          >
            <div className="relative">
              <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
                <circle
                  cx="28"
                  cy="28"
                  r={R}
                  fill="none"
                  stroke="var(--line)"
                  strokeWidth="4"
                />
                <circle
                  cx="28"
                  cy="28"
                  r={R}
                  fill="none"
                  stroke={def.colorVar}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${frac * CIRC} ${CIRC}`}
                  transform="rotate(-90 28 28)"
                  style={{ filter: `drop-shadow(0 0 4px ${def.colorVar})` }}
                />
              </svg>
              <p className="absolute inset-0 flex items-center justify-center font-mono text-sm">
                <span className="text-muted">L</span>
                {row.level}
              </p>
            </div>
            <p className="text-[11px] text-muted">{def.label}</p>
            <p className="sr-only">
              {row.xp} van {row.xp_max} XP
            </p>
          </li>
        );
      })}
    </ul>
  );
}
