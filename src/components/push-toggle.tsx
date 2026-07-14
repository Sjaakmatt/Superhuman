"use client";

import { useEffect, useState, useTransition } from "react";
import {
  removePushSubscription,
  savePushSubscription,
} from "@/app/(app)/actions";
import { useToast } from "./toast";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type PushState = "loading" | "unsupported" | "off" | "on" | "denied";

export function PushToggle() {
  const [state, setState] = useState<PushState>("loading");
  const [pending, startTransition] = useTransition();
  const { showMessage } = useToast();
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setState(subscription ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  function enable() {
    startTransition(async () => {
      try {
        if (!vapidKey) {
          showMessage("VAPID-key ontbreekt — zie .env.example.");
          return;
        }
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
        });
        const result = await savePushSubscription(
          subscription.toJSON() as Record<string, unknown>,
        );
        if (result.error) {
          showMessage(result.error);
          return;
        }
        setState("on");
        showMessage("Push-notificaties staan aan.");
      } catch {
        showMessage("Inschakelen mislukte — probeer het nog eens.");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
      showMessage("Push-notificaties staan uit.");
    });
  }

  const description: Record<PushState, string> = {
    loading: "Status controleren…",
    unsupported: "Deze browser ondersteunt geen web-push.",
    denied: "Notificaties zijn geblokkeerd in je browserinstellingen.",
    off: "Ontvang je reminders als notificatie op dit apparaat.",
    on: "Dit apparaat ontvangt reminders als notificatie.",
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Push-notificaties</p>
        <p className="mt-0.5 text-xs text-muted">{description[state]}</p>
      </div>
      {state === "on" || state === "off" ? (
        <button
          type="button"
          onClick={state === "on" ? disable : enable}
          disabled={pending}
          aria-pressed={state === "on"}
          className={`rounded-lg border px-4 py-2 text-sm transition-colors disabled:opacity-40 ${
            state === "on"
              ? "border-vitaliteit bg-vitaliteit/10 text-text"
              : "border-line text-muted hover:text-text"
          }`}
        >
          {state === "on" ? "Aan" : "Zet aan"}
        </button>
      ) : null}
    </div>
  );
}
