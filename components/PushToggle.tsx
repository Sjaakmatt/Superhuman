'use client';

import { useEffect, useState } from 'react';
import { Card, CardTitle, Note } from '@/components/ui';

/** Aan- of afmelden voor de ochtendmelding. De melding zelf komt van de server
 *  om zes uur; de service worker zet hem op het scherm. */
export default function PushToggle({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [state, setState] = useState<'onbekend' | 'uit' | 'aan' | 'kan-niet' | 'bezig'>('onbekend');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vapidPublicKey || typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('kan-niet');
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'aan' : 'uit'))
      .catch(() => setState('kan-niet'));
  }, [vapidPublicKey]);

  async function toggle() {
    if (!vapidPublicKey) return;
    setState('bezig');
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();

      if (existing) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        await existing.unsubscribe();
        setState('uit');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('uit');
        setError('Je browser gaf geen toestemming voor meldingen.');
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Aanmelden mislukt.');
      setState('aan');
    } catch (err) {
      setState('uit');
      setError((err as Error).message);
    }
  }

  return (
    <Card>
      <CardTitle aside={state === 'aan' ? 'aan' : state === 'kan-niet' ? 'niet beschikbaar' : 'uit'}>
        Ochtendmelding
      </CardTitle>
      <p className="max-w-[52ch] text-[14px] leading-relaxed">
        Om zes uur een melding met de sessie van vandaag. Niets meer: geen aanmoediging, geen herinnering dat je
        gisteren niets deed.
      </p>
      {state === 'kan-niet' ? (
        <Note>
          Deze browser kan geen meldingen ontvangen, of de VAPID-sleutels ontbreken. Op iOS werkt het alleen als je de
          app eerst aan je beginscherm toevoegt.
        </Note>
      ) : (
        <button type="button" onClick={toggle} disabled={state === 'bezig'}
          className="interactive mt-4 rounded-[var(--r-btn)] px-4 py-2.5 text-[13px] font-semibold"
          style={{
            background: state === 'aan' ? 'var(--acc-soft)' : 'var(--acc)',
            color: state === 'aan' ? 'var(--acc)' : 'var(--acc-ink)',
          }}>
          {state === 'bezig' ? 'bezig…' : state === 'aan' ? 'Zet uit' : 'Zet aan'}
        </button>
      )}
      {error ? <p className="mt-3 text-[12px]" style={{ color: 'var(--crit)' }}>{error}</p> : null}
    </Card>
  );
}

/** De sleutel komt als base64url binnen; PushManager wil ruwe bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
