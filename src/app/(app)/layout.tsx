import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/bottom-nav";
import { SideNav } from "@/components/side-nav";
import { ToastProvider } from "@/components/toast";
import { SwRegister } from "@/components/sw-register";
import { signOut } from "@/app/(auth)/actions";

/**
 * Beschermde app-layout: de proxy doet de optimistische check,
 * hier zit de echte server-side verificatie. Mobiel: bottom-nav +
 * header. Desktop (lg+): zijbalk links + bredere content-kolom.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
