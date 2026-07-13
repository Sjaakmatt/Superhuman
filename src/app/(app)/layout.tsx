import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/bottom-nav";
import { signOut } from "@/app/(auth)/actions";

/**
 * Beschermde app-layout: de proxy doet de optimistische check,
 * hier zit de echte server-side verificatie.
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
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="flex items-center justify-between px-4 pt-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
          Superhuman OS
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="text-[11px] text-muted transition-colors hover:text-text"
          >
            Uitloggen
          </button>
        </form>
      </header>
      <main className="flex-1 px-4 pb-28 pt-6">{children}</main>
      <BottomNav />
    </div>
  );
}
