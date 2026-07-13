import { createClient } from "@/lib/supabase/server";
import type { JournalEntryRow } from "@/lib/types";
import { JournalForm } from "@/components/journal-form";

export const metadata = { title: "Journal" };

export default async function JournalPage() {
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("journal_entries")
    .select("id, date, type, content, mood")
    .order("id", { ascending: false })
    .limit(14);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Journal</h1>
        <p className="mt-1 text-sm text-muted">
          Schrijf kort; je stemming verschijnt later als output in Progressie.
        </p>
      </div>

      <JournalForm />

      {(entries ?? []).length > 0 ? (
        <section aria-label="Recente entries" className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted">Recent</h2>
          <ul className="flex flex-col gap-2">
            {((entries ?? []) as JournalEntryRow[]).map((entry) => (
              <li
                key={entry.id}
                className="rounded-2xl border border-line bg-card p-4"
              >
                <div className="flex items-center justify-between font-mono text-xs text-muted">
                  <span>
                    {entry.date} · {entry.type}
                  </span>
                  {entry.mood ? <span>stemming {entry.mood}/10</span> : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {entry.content}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
