import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
      <main className="flex-1 px-4 pb-24 pt-6">{children}</main>
    </div>
  );
}
