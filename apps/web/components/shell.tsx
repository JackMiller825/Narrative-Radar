"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/login/actions";
import { deskAction, formatWhen } from "@/lib/utils";
import type { DeskData } from "@/lib/types";
import { Bell, Bookmark, Radar, Rss, Settings, SunMedium, MoonStar, Waves } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

const themeListeners = new Set<() => void>();
function subscribeTheme(callback: () => void) {
  themeListeners.add(callback);
  return () => themeListeners.delete(callback);
}
function emitTheme() {
  themeListeners.forEach((callback) => callback());
}
function getTheme() {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

const LINKS = [
  { href: "/radar", label: "Live Radar", icon: Radar },
  { href: "/shortlist", label: "Shortlist", icon: Bookmark },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/sources", label: "Sources", icon: Rss },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/saturation", label: "Saturation", icon: Waves },
];

export function Shell({ desk, children, initialTheme = "dark" }: { desk: DeskData; children: React.ReactNode; initialTheme?: "dark" | "light" }) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => initialTheme);
  const unread = desk.alerts.filter((alert) => !alert.readAt && alert.status !== "suppressed").length;
  const status = desk.settings.paused ? "Paused" : desk.worker.online ? "Worker live" : "Worker offline";
  const tone = desk.settings.paused ? "text-amber-300" : desk.worker.online ? "text-mint" : "text-amber-300";

  async function scan() {
    setBusy(true);
    setError(null);
    try {
      await deskAction({ action: "scan" });
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Scan failed.");
    } finally {
      setBusy(false);
    }
  }

  async function changeInterval(schedulePreset: string) {
    setBusy(true);
    setError(null);
    try {
      await deskAction({ action: "settings", schedulePreset });
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not change the interval.");
    } finally {
      setBusy(false);
    }
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    document.cookie = `radar-theme=${next}; path=/; max-age=31536000; samesite=lax`;
    window.localStorage.setItem("radar-theme", next);
    emitTheme();
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-line md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 px-4 py-4 md:px-5">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-card text-mint" aria-hidden>
            <Radar size={18} />
          </span>
          <div>
            <p className="display text-lg leading-none">Narrative Radar</p>
            <p className="text-xs text-muted">{desk.workspace.mode === "demo" ? "Demo mode" : "Live mode"}</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1 md:px-3" aria-label="Primary">
          {LINKS.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link key={link.href} href={link.href} className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm ${active ? "bg-card text-foreground" : "text-muted hover:bg-card/70"}`}>
                <Icon size={16} aria-hidden />
                {link.label}
                {link.href === "/alerts" && unread > 0 ? <Badge>{unread}</Badge> : null}
              </Link>
            );
          })}
        </nav>
        <form action={signOutAction} className="px-3 pb-4">
          <button type="submit" className="rounded-2xl px-3 py-2 text-sm text-muted hover:bg-card/70">Sign out</button>
        </form>
      </aside>
      <div>
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line bg-background/85 px-4 py-3 backdrop-blur">
          <p className={`text-sm font-medium ${tone}`} title="A connected event stream is not treated as proof that sources are healthy.">{status}</p>
          <form action="/radar" method="get" className="min-w-40 flex-1">
            <input name="q" aria-label="Search the desk" placeholder="Search title, name, ticker" className="h-8 w-full rounded-full border border-line bg-card px-3 text-sm" />
          </form>
          <p className="text-xs text-muted">Next scan {formatWhen(desk.settings.nextDueAt, desk.settings.timezone)}</p>
          <p className="text-xs text-muted">Last success {formatWhen(desk.settings.lastSuccessfulAt, desk.settings.timezone)}</p>
          <p className="text-xs text-muted">Last attempt {formatWhen(desk.settings.lastAttemptedAt, desk.settings.timezone)}</p>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-muted">
              <select
                aria-label="Scan interval"
                className="h-8 rounded-full border border-line bg-card px-2 text-xs text-foreground"
                value={desk.settings.schedulePreset}
                disabled={busy}
                onChange={(event) => changeInterval(event.target.value)}
              >
                <option value="1m">1m</option>
                <option value="5m">5m</option>
                <option value="15m">15m</option>
                <option value="1h">1h</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <Button type="button" variant="outline" size="sm" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
              {theme === "dark" ? <SunMedium size={16} /> : <MoonStar size={16} />}
            </Button>
            <Button type="button" size="sm" onClick={scan} disabled={busy}>{busy ? "Scanning…" : "Scan now"}</Button>
          </div>
          {error ? <p className="w-full text-sm text-red-300" role="alert">{error}</p> : null}
        </header>
        <div className="px-4 py-5 md:px-6">{children}</div>
      </div>
    </div>
  );
}
