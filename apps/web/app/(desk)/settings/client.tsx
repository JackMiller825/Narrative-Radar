"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deskAction } from "@/lib/utils";
import type { DeskData } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function SettingsForm({ desk }: { desk: DeskData }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [preset, setPreset] = useState(desk.settings.schedulePreset);
  const [custom, setCustom] = useState(desk.settings.customIntervalSeconds);
  const [paused, setPaused] = useState(desk.settings.paused);
  const [mode, setMode] = useState(desk.workspace.mode);
  const [chain, setChain] = useState(desk.settings.chainPreference);
  const [timezone, setTimezone] = useState(desk.settings.timezone);
  const [style, setStyle] = useState(desk.settings.namingStyle);
  const [keywords, setKeywords] = useState(desk.settings.excludedKeywords.join(", "));
  const [watched, setWatched] = useState(desk.settings.watchedEntities.join(", "));
  const [retention, setRetention] = useState(desk.settings.retentionDays);
  const [limit, setLimit] = useState(desk.settings.dailyRequestLimit);

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      await deskAction({
        action: "settings",
        mode,
        schedulePreset: preset,
        customIntervalSeconds: Number(custom),
        paused,
        chainPreference: chain,
        timezone,
        namingStyle: style,
        excludedKeywords: keywords.split(",").map((item) => item.trim()).filter(Boolean),
        watchedEntities: watched.split(",").map((item) => item.trim()).filter(Boolean),
        retentionDays: Number(retention),
        dailyRequestLimit: Number(limit),
      });
      setMessage("Settings saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save.");
    }
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-5">
      <h1 className="display text-4xl">Settings</h1>
      <p className="text-sm text-muted">Intervals are elapsed seconds, stored in UTC and shown in your timezone. A one-minute schedule checks eligible sources once a minute. It does not promise every internet event within a minute. Pausing stops new scans. A scan already running is allowed to finish.</p>
      <label className="block text-sm">Mode
        <select className="mt-1 h-10 w-full rounded-xl border border-line bg-card px-3" value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="demo">Demo</option>
          <option value="live">Live</option>
        </select>
      </label>
      <label className="block text-sm">Chain preference
        <Input className="mt-1" value={chain} onChange={(event) => setChain(event.target.value)} />
      </label>
      <label className="block text-sm">Schedule
        <select className="mt-1 h-10 w-full rounded-xl border border-line bg-card px-3" value={preset} onChange={(event) => setPreset(event.target.value)}>
          <option value="1m">1 minute</option>
          <option value="5m">5 minutes</option>
          <option value="15m">15 minutes</option>
          <option value="1h">1 hour</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      {preset === "custom" ? (
        <label className="block text-sm">Custom seconds (60–86400)
          <Input className="mt-1" type="number" min={60} max={86400} value={custom} onChange={(event) => setCustom(Number(event.target.value))} />
        </label>
      ) : null}
      <p className="text-sm text-muted">{desk.schedule.preview.note} About {desk.schedule.preview.checksPerDay} checks a day at the current interval.</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={paused} onChange={(event) => setPaused(event.target.checked)} /> Pause new scans</label>
      <label className="block text-sm">Timezone
        <Input className="mt-1" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
      </label>
      <label className="block text-sm">Naming style
        <select className="mt-1 h-10 w-full rounded-xl border border-line bg-card px-3" value={style} onChange={(event) => setStyle(event.target.value)}>
          {["cute", "absurd", "minimalist", "futuristic", "ethereum"].map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label className="block text-sm">Excluded keywords, comma separated
        <Input className="mt-1" value={keywords} onChange={(event) => setKeywords(event.target.value)} />
      </label>
      <label className="block text-sm">Watched entities
        <Input className="mt-1" value={watched} onChange={(event) => setWatched(event.target.value)} />
      </label>
      <label className="block text-sm">Daily request limit
        <Input className="mt-1" type="number" value={limit} onChange={(event) => setLimit(Number(event.target.value))} />
      </label>
      <label className="block text-sm">Retention days
        <Input className="mt-1" type="number" value={retention} onChange={(event) => setRetention(Number(event.target.value))} />
      </label>
      <p className="text-sm text-muted">{desk.settings.priceAssumptions?.note ?? "Dollar figures are assumptions, not invoices."} Text budget {desk.settings.textBudgetUsd ?? "not set"}. Image budget {desk.settings.imageBudgetUsd ?? "not set"}.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Save settings</Button>
        <Button type="button" variant="outline" onClick={() => deskAction({ action: "retention" }).then((result) => setMessage(`Removed ${String((result as { removed?: number }).removed ?? 0)} old unsaved candidates.`)).catch((error) => setMessage(error.message))}>Apply retention now</Button>
      </div>
      {message ? <p className="text-sm text-mint" role="status">{message}</p> : null}
      <section>
        <h2 className="font-medium">Recent scans</h2>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {desk.scans.length === 0 ? <li>No scans yet.</li> : null}
          {desk.scans.map((scan) => <li key={scan.id}>{scan.trigger} · {scan.status}{scan.error ? ` · ${scan.error}` : ""}</li>)}
        </ul>
      </section>
    </form>
  );
}
