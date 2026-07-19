import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Geest" };

interface HubCard {
  href: string;
  title: string;
  meta: string;
  xp: string;
}

export default async function GeestPage() {
  const supabase = await createClient();
  const [{ count: levelCount }, { count: medLevelCount }] = await Promise.all([
    supabase.from("breath_levels").select("id", { count: "exact", head: true }),
    supabase
      .from("meditation_levels")
      .select("id", { count: "exact", head: true }),
  ]);

  const cards: HubCard[] = [
    {
      href: "/geest/ademwerk",
      title: "Ademwerk",
      meta: `${levelCount ?? 0} niveaus · van rustig ademen tot verbonden ademhaling`,
      xp: "+25 XP",
    },
    {
      href: "/geest/meditatie",
      title: "Meditatie",
      meta: `${medLevelCount ?? 0} niveaus · van rustig landen tot diepe stilte`,
      xp: "+30 XP",
    },
    {
      href: "/geest/journal",
      title: "Journal",
      meta: "Ochtend, avond, dankbaarheid of vrij · met stemming",
      xp: "+15 XP",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Geest</h1>
        <p className="mt-1 text-sm text-muted">
          Meditatie, breathwork en journaling.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {cards.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-muted"
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{
                  background: "var(--attr-geest)",
                  boxShadow: "0 0 10px var(--attr-geest)",
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{card.title}</span>
                <span className="block text-xs text-muted">{card.meta}</span>
              </span>
              <span className="font-mono text-xs text-muted">{card.xp}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
