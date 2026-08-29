/* Supabase geeft zijn foutmeldingen in het Engels terug. Alle interfacetekst in
 * deze app is Nederlands, dus vertalen we de gevallen die je echt tegenkomt en
 * laten we de rest herkenbaar staan in plaats van hem te verdoezelen. */

const VERTALINGEN: [RegExp, string][] = [
  [/invalid login credentials/i, 'Dat e-mailadres en wachtwoord horen niet bij elkaar.'],
  [/email not confirmed/i, 'Je e-mailadres is nog niet bevestigd. Kijk in je mail.'],
  [/user not found/i, 'Er hoort geen account bij dit e-mailadres.'],
  [/password should be at least (\d+)/i, 'Je wachtwoord moet minstens $1 tekens hebben.'],
  [/new password should be different/i, 'Kies een ander wachtwoord dan je vorige.'],
  [/for security purposes.*after (\d+) seconds?/i, 'Even wachten — probeer het over $1 seconden opnieuw.'],
  [/email rate limit exceeded|over_email_send_rate_limit/i, 'Er zijn net te veel mails verstuurd. Probeer het over een paar minuten opnieuw.'],
  [/token has expired or is invalid|otp_expired/i, 'Deze link is verlopen of al gebruikt. Vraag een nieuwe aan.'],
  [/signups not allowed|signup is disabled/i, 'Aanmelden staat uit. Deze app is voor één gebruiker.'],
  [/auth session missing/i, 'Je sessie is verlopen. Log opnieuw in.'],
  [/failed to fetch|network/i, 'Geen verbinding met de server. Controleer je netwerk.'],
];

/** Zet een Supabase-foutmelding om naar gewone taal. Onbekende meldingen laten
 *  we staan: liever een Engelse zin die klopt dan een Nederlandse die gokt. */
export function inHetNederlands(message: string): string {
  for (const [patroon, vertaling] of VERTALINGEN) {
    const match = patroon.exec(message);
    if (match) return vertaling.replace(/\$(\d)/g, (_, n) => match[Number(n)] ?? '');
  }
  return message;
}

/** Ondergrens voor een nieuw wachtwoord. Supabase bewaakt zijn eigen minimum
 *  (Auth → Policies); dit is de controle vóór je op verzenden drukt. */
export const MINIMALE_WACHTWOORDLENGTE = 10;

export function keurWachtwoord(wachtwoord: string): string | null {
  if (wachtwoord.length < MINIMALE_WACHTWOORDLENGTE) {
    return `Minstens ${MINIMALE_WACHTWOORDLENGTE} tekens. Een zin werkt beter dan een kort woord met tekens erin.`;
  }
  return null;
}
