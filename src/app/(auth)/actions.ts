"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function credentialsFrom(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

export async function login(formData: FormData) {
  const { email, password } = credentialsFrom(formData);
  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Vul e-mail en wachtwoord in.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/vandaag");
}

export async function signup(formData: FormData) {
  const { email, password } = credentialsFrom(formData);
  if (!email || password.length < 8) {
    redirect(
      `/signup?error=${encodeURIComponent("Vul een e-mailadres in en kies een wachtwoord van minimaal 8 tekens.")}`,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  // Zonder e-mailbevestiging is er direct een sessie; anders eerst mail checken.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/vandaag");
  }
  redirect("/signup?sent=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
