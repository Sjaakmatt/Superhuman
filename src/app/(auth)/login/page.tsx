import Link from "next/link";
import { login } from "../actions";

export const metadata = { title: "Inloggen" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="rounded-2xl border border-line bg-card p-6">
      <h1 className="text-lg font-semibold">Inloggen</h1>
      <p className="mt-1 text-sm text-muted">
        Welkom terug. Je core wacht op je.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-geest/40 bg-geest/10 px-3 py-2 text-sm text-geest"
        >
          {error}
        </p>
      ) : null}

      <form action={login} className="mt-6 flex flex-col gap-4">
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
          <span className="text-muted">Wachtwoord</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-text"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
        >
          Inloggen
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Nog geen account?{" "}
        <Link href="/signup" className="text-text underline underline-offset-4">
          Account aanmaken
        </Link>
      </p>
    </div>
  );
}
