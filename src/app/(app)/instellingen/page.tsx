import { createClient } from "@/lib/supabase/server";
import type { ReminderRow } from "@/lib/types";
import { ProfileForm } from "@/components/profile-form";
import { PushToggle } from "@/components/push-toggle";
import { RemindersManager } from "@/components/reminders-manager";

export const metadata = { title: "Instellingen" };

export default async function InstellingenPage() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: profile },
    { data: reminders },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("display_name, timezone").single(),
    supabase
      .from("reminders")
      .select("id, kind, label, schedule, enabled")
      .order("id"),
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

      <section aria-label="Notificaties" className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">Notificaties</h2>
        <PushToggle />
        <RemindersManager reminders={(reminders ?? []) as ReminderRow[]} />
      </section>
    </div>
  );
}
