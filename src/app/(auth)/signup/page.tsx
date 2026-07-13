import Link from "next/link";
import { signup } from "../actions";

export const metadata = { title: "Account aanmaken" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  if (sent) {
    return (
      <div className="rounded-2xl border border-line bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">Check je e-mail</h1>
        <p className="mt-2 text-sm text-muted">
          We hebben je een bevestigingslink gestuurd. Klik erop om je account
          te activeren, en log daarna in.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm text-text underline underline-offset-4"
        >
          Naar inloggen
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-6">
      <h1 className="text-lg font-semibold">Account aanmaken</h1>
      <p className="mt-1 text-sm text-muted">
        Dag één van je superhuman-progressie.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-geest/40 bg-geest/10 px-3 py-2 text-sm text-geest"
        >
          {error}
        </p>
      ) : null}

      <form action={signup} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">E-mail</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-text placeholder:text-muted/60"
            placeholder="jij@voorbeeld.nl"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">Wachtwoord (min. 8 tekens)</span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-text"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
        >
          Account aanmaken
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Al een account?{" "}
        <Link href="/login" className="text-text underline underline-offset-4">
          Inloggen
        </Link>
      </p>
    </div>
  );
}
