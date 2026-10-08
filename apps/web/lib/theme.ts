export async function readInitialTheme(): Promise<"dark" | "light"> {
  if (process.env.GITHUB_PAGES === "1") return "dark";
  const { cookies } = await import("next/headers");
  const value = (await cookies()).get("radar-theme")?.value;
  return value === "light" ? "light" : "dark";
}
