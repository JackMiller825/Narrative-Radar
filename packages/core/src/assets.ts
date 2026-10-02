import type { Motif, NamingStyle } from "./types";
import { sha1, xmlEscape } from "./text";

export interface Palette {
  name: string;
  bg: string;
  fg: string;
  accent: string;
  ink: string;
}

export const PALETTES: Palette[] = [
  { name: "violet-mint", bg: "#24184a", fg: "#f4efe4", accent: "#3ee0b0", ink: "#d7c6ff" },
  { name: "harbor", bg: "#123044", fg: "#f7efe2", accent: "#7ad7ff", ink: "#f3d7b5" },
  { name: "marigold", bg: "#3a2412", fg: "#fff6e8", accent: "#ffb703", ink: "#ffd6a5" },
  { name: "lilac", bg: "#2a2148", fg: "#f7f2ff", accent: "#c4b5fd", ink: "#fbcfe8" },
  { name: "moss", bg: "#163026", fg: "#f3f7ef", accent: "#9dce6a", ink: "#d9f99d" },
  { name: "ink", bg: "#171520", fg: "#f5f3ff", accent: "#fb7185", ink: "#e9d5ff" },
];

const MOTIFS: Motif[] = ["rocket", "robot", "frog", "cloud", "star", "circuit", "abstract"];

export function pickMotif(seed: string): Motif {
  const index = Number.parseInt(sha1(seed).slice(0, 2), 16) % MOTIFS.length;
  return MOTIFS[index]!;
}

export function pickPalette(seed: string, shift = 0): Palette {
  const index = (Number.parseInt(sha1(seed).slice(2, 4), 16) + shift) % PALETTES.length;
  return PALETTES[index]!;
}

export function illustrationCacheKey(input: {
  narrativeId: string;
  motif: Motif;
  paletteName: string;
  style: NamingStyle;
  promptVersion: string;
}): string {
  return sha1(`art|${input.narrativeId}|${input.motif}|${input.paletteName}|${input.style}|${input.promptVersion}`);
}

export function textLayerKey(input: { illustrationKey: string; name: string; ticker: string }): string {
  return sha1(`text|${input.illustrationKey}|${input.name}|${input.ticker}`);
}

export function renderLogoSvg(input: {
  motif: Motif;
  palette: Palette;
  name: string;
  ticker: string;
}): string {
  const label = xmlEscape(input.ticker.slice(0, 8));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img" aria-label="${xmlEscape(input.name)} logo">
  <g id="mark">
    <circle cx="512" cy="512" r="430" fill="${input.palette.bg}"/>
    <circle cx="512" cy="512" r="390" fill="none" stroke="${input.palette.accent}" stroke-width="18"/>
    ${motifMarkup(input.motif, input.palette, 512, 470, 1)}
    <text x="512" y="760" text-anchor="middle" font-family="ui-sans-serif, sans-serif" font-size="92" font-weight="700" fill="${input.palette.fg}">${label}</text>
  </g>
</svg>`;
}

export function renderBannerSvg(input: {
  motif: Motif;
  palette: Palette;
  name: string;
  ticker: string;
  narrativeTitle: string;
}): string {
  const name = xmlEscape(input.name);
  const ticker = xmlEscape(input.ticker);
  const title = xmlEscape(truncate(input.narrativeTitle, 72));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 500" width="1500" height="500" role="img" aria-label="${name} banner">
  <rect width="1500" height="500" fill="${input.palette.bg}"/>
  <circle cx="250" cy="250" r="150" fill="none" stroke="${input.palette.accent}" stroke-width="10"/>
  ${motifMarkup(input.motif, input.palette, 250, 250, 0.62)}
  <text x="460" y="210" font-family="ui-sans-serif, sans-serif" font-size="72" font-weight="700" fill="${input.palette.fg}">${name}</text>
  <text x="460" y="280" font-family="ui-sans-serif, sans-serif" font-size="36" fill="${input.palette.accent}">${ticker}</text>
  <text x="460" y="350" font-family="ui-sans-serif, sans-serif" font-size="28" fill="${input.palette.ink}">${title}</text>
</svg>`;
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 1)}…`;
}

function motifMarkup(motif: Motif, palette: Palette, x: number, y: number, scale: number): string {
  const accent = palette.accent;
  const fg = palette.fg;
  const transform = `translate(${x} ${y}) scale(${scale})`;
  const body = (() => {
    switch (motif) {
      case "rocket":
        return `<polygon points="0,-120 70,40 -70,40" fill="${accent}"/><rect x="-28" y="40" width="56" height="36" rx="8" fill="${fg}"/><circle cx="0" cy="-10" r="16" fill="${palette.bg}"/>`;
      case "robot":
        return `<rect x="-70" y="-50" width="140" height="110" rx="24" fill="${fg}"/><circle cx="-28" cy="-8" r="12" fill="${palette.bg}"/><circle cx="28" cy="-8" r="12" fill="${palette.bg}"/><rect x="-24" y="28" width="48" height="10" rx="5" fill="${accent}"/><rect x="-16" y="-90" width="32" height="28" rx="8" fill="${accent}"/>`;
      case "frog":
        return `<ellipse cx="0" cy="10" rx="90" ry="60" fill="${accent}"/><circle cx="-38" cy="-40" r="28" fill="${fg}"/><circle cx="38" cy="-40" r="28" fill="${fg}"/><circle cx="-38" cy="-40" r="10" fill="${palette.bg}"/><circle cx="38" cy="-40" r="10" fill="${palette.bg}"/><path d="M-20 24 Q0 42 20 24" fill="none" stroke="${palette.bg}" stroke-width="8" stroke-linecap="round"/>`;
      case "cloud":
        return `<ellipse cx="-30" cy="10" rx="70" ry="46" fill="${fg}"/><ellipse cx="40" cy="0" rx="64" ry="50" fill="${fg}"/><ellipse cx="0" cy="-30" rx="54" ry="42" fill="${accent}"/>`;
      case "star":
        return `<polygon points="0,-110 26,-34 106,-34 42,14 64,90 0,48 -64,90 -42,14 -106,-34 -26,-34" fill="${accent}"/>`;
      case "circuit":
        return `<rect x="-80" y="-80" width="160" height="160" rx="28" fill="none" stroke="${accent}" stroke-width="12"/><path d="M-80 0 H-20 V50 H40 V-30 H80" fill="none" stroke="${fg}" stroke-width="12" stroke-linecap="round"/><circle cx="-20" cy="0" r="10" fill="${accent}"/><circle cx="40" cy="50" r="10" fill="${accent}"/>`;
      default:
        return `<circle cx="0" cy="0" r="78" fill="${accent}"/><circle cx="-24" cy="-10" r="22" fill="${fg}"/><circle cx="30" cy="16" r="16" fill="${palette.bg}"/>`;
    }
  })();
  return `<g transform="${transform}">${body}</g>`;
}

export function assertTemplateSvg(svg: string): void {
  if (/<script|foreignObject|<!ENTITY|javascript:|onload=/i.test(svg)) {
    throw new Error("Template SVG contains a disallowed primitive.");
  }
}
