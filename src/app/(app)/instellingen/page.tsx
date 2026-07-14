import { createClient } from "@/lib/supabase/server";
import type { ReminderRow, ScheduleBlockRow } from "@/lib/types";
import { ProfileForm } from "@/components/profile-form";
import { PushToggle } from "@/components/push-toggle";
import { RemindersManager } from "@/components/reminders-manager";
import { ScheduleManager } from "@/components/schedule-manager";

export const metadata = { title: "Instellingen" };

export default async function InstellingenPage() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: profile },
    { data: reminders },
    { data: blocks },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("display_name, timezone").single(),
    supabase
      .from("reminders")
      .select("id, kind, label, schedule, enabled")
      .order("id"),
    supabase
      .from("schedule_blocks")
      .select("id, label, kind, ref_id, start_min, window_min, days, enabled")
      .order("start_min"),
  ]);
  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Instellingen</h1>
        <p className="mt-1 text-sm text-muted">{user.email}</p>
      </div>

      <section aria-label="Profiel" className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">Profiel</h2>
        <ProfileForm
          initial={{
            displayName: profile?.display_name ?? "",
            timezone: profile?.timezone ?? "Europe/Amsterdam",
          }}
        />
      </section>

      <section aria-label="Dagritme" className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">Dagritme</h2>
        <p className="text-xs text-muted">
          Deze blokken sturen de &ldquo;Nu&rdquo;-kaart op Vandaag. Synchroniseer
          ze naar herinneringen om ook buiten de app een duwtje te krijgen.
        </p>
        <ScheduleManager blocks={(blocks ?? []) as ScheduleBlockRow[]} />
      </section>

      <section aria-label="Notificaties" className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">Notificaties</h2>
        <PushToggle />
        <RemindersManager reminders={(reminders ?? []) as ReminderRow[]} />
      </section>
    </div>
  );
}
