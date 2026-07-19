import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { SideNav } from "@/components/side-nav";
import { ToastProvider } from "@/components/toast";
import { SwRegister } from "@/components/sw-register";
import { signOut } from "@/app/(auth)/actions";

/**
 * Beschermde app-layout. Auth wordt afgedwongen in de proxy (die op elk
 * request `getUser()` draait en niet-ingelogde gebruikers naar /login
 * stuurt) en door RLS op alle data. Hier dus géén tweede auth-round-trip —
 * dat scheelt een netwerkcall per navigatie. Mobiel: bottom-nav + header.
 * Desktop (lg+): zijbalk links + bredere content-kolom.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh lg:flex">
      <SideNav />

      <div className="flex min-h-dvh w-full flex-col lg:min-w-0 lg:flex-1">
        {/* Mobiele header (op desktop staat dit in de zijbalk) */}
        <header className="flex items-center justify-between px-4 pt-5 lg:hidden">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
            Superhuman OS
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/instellingen"
              className="text-[11px] text-muted transition-colors hover:text-text"
            >
              Instellingen
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="text-[11px] text-muted transition-colors hover:text-text"
              >
                Uitloggen
              </button>
            </form>
          </div>
        </header>

        <SwRegister />
        <ToastProvider>
          <main className="mx-auto w-full max-w-md flex-1 px-4 pb-28 pt-6 lg:max-w-4xl lg:px-10 lg:pb-14 lg:pt-10">
            {children}
          </main>
        </ToastProvider>
      </div>

      <BottomNav />
    </div>
  );
}
