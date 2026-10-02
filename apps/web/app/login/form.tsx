"use client";

import { loginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionState } from "react";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm font-medium" htmlFor="email">Email</label>
      <Input id="email" name="email" type="email" autoComplete="username" required />
      <label className="block text-sm font-medium" htmlFor="password">Password</label>
      <Input id="password" name="password" type="password" autoComplete="current-password" required />
      {state?.error ? <p className="text-sm text-red-300" role="alert">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Checking…" : "Enter the desk"}</Button>
    </form>
  );
}
