// Verstuurt web-push voor reminders die "nu" gepland staan.
// Draait elke 5 minuten via pg_cron + pg_net (zie supabase/README.md).
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, optioneel VAPID_SUBJECT.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SLOT_MINUTES = 5;

interface ReminderRow {
  id: number;
  user_id: string;
  kind: string;
  label: string | null;
  schedule: { times?: string[]; days?: string[] } | null;
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const KIND_CONTENT: Record<string, { title: string; body: string; url: string }> = {
  water: {
    title: "Water",
    body: "Tijd voor een glas water. Je core gloeit ervan.",
    url: "/vandaag",
  },
  stretch: {
    title: "Stretchen",
    body: "Een korte stretch-sessie houdt je soepel.",
    url: "/beweging/stretch",
  },
  meditation: {
    title: "Meditatie",
    body: "Een paar minuten stilte voor je geest.",
    url: "/geest/meditaties",
  },
  review: {
    title: "Wekelijkse review",
    body: "Vijf minuten: je week in cijfers staat al klaar.",
    url: "/review",
  },
};

function localParts(timezone: string): { minutes: number; day: string } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  );
  const dayIndex = new Date(
    now.toLocaleString("en-US", { timeZone: timezone }),
  ).getDay();
  return {
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
    day: DAY_CODES[dayIndex],
  };
}

function timeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

Deno.serve(async () => {
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!vapidPublic || !vapidPrivate) {
    return new Response(
      JSON.stringify({ error: "VAPID keys niet geconfigureerd" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@superhuman.local",
    vapidPublic,
    vapidPrivate,
  );

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: reminders, error } = await supabase
    .from("reminders")
    .select("id, user_id, kind, label, schedule")
    .eq("enabled", true);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Tijdzones van alle betrokken gebruikers in één query
  const userIds = [...new Set((reminders ?? []).map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, timezone")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const tzByUser = new Map(
    (profiles ?? []).map((p) => [p.id, p.timezone ?? "Europe/Amsterdam"]),
  );

  // Welke reminders zijn nu "due" (binnen het 5-minuten-slot)?
  const due: ReminderRow[] = [];
  for (const reminder of (reminders ?? []) as ReminderRow[]) {
    const tz = tzByUser.get(reminder.user_id) ?? "Europe/Amsterdam";
    const { minutes, day } = localParts(tz);
    const slotStart = Math.floor(minutes / SLOT_MINUTES) * SLOT_MINUTES;
    const days = reminder.schedule?.days ?? [];
    const times = reminder.schedule?.times ?? [];
    if (!days.includes(day)) continue;
    const hit = times.some((t) => {
      const m = timeToMinutes(t);
      return m != null && m >= slotStart && m < slotStart + SLOT_MINUTES;
    });
    if (hit) due.push(reminder);
  }

  if (due.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, subscription")
    .in("user_id", [...new Set(due.map((r) => r.user_id))]);

  let sent = 0;
  const dead: number[] = [];
  for (const reminder of due) {
    const content = KIND_CONTENT[reminder.kind] ?? {
      title: reminder.label ?? "Reminder",
      body: "Kleine actie, grote gloed.",
      url: "/vandaag",
    };
    const payload = JSON.stringify({
      title: content.title,
      body: reminder.label && reminder.kind === "custom"
        ? reminder.label
        : content.body,
      url: content.url,
    });

    for (const row of (subscriptions ?? []).filter(
      (s) => s.user_id === reminder.user_id,
    )) {
      try {
        await webpush.sendNotification(row.subscription, payload);
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(row.id);
      }
    }
  }

  if (dead.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", dead);
  }

  return new Response(JSON.stringify({ sent, cleaned: dead.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
