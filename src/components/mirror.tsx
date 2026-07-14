import { Eye } from "lucide-react";
import type { Reflection } from "@/lib/reflections";

/**
 * De spiegel: de stem van het OS zonder chatbot. Twee regels die je
 * gedrag terugkaatsen, berekend uit echte data.
 */
export function Mirror({ reflections }: { reflections: Reflection[] }) {
  if (reflections.length === 0) return null;

  return (
    <section aria-label="De spiegel" className="flex flex-col gap-2.5">
      <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.15em] text-muted">
        <Eye size={14} aria-hidden /> De spiegel
      </h2>
      <ul className="flex flex-col gap-2">
        {reflections.map((r, i) => (
          <li
            key={i}
            className="rounded-xl border border-line bg-card px-4 py-3 text-sm leading-relaxed"
            style={{
              borderLeft: `3px solid ${r.color}`,
              animation: "rise-in .4s ease",
            }}
          >
            {r.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
