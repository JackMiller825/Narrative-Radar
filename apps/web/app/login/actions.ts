"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function loginAction(_state: { error?: string } | null, formData: FormData) {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/radar",
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Those credentials were not accepted." };
    throw error;
  }
  return null;
}
