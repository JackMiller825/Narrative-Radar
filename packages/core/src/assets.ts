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

export interface ArtInput {
  motif: Motif;
  palette: Palette;
  name: string;
  ticker: string;
  narrativeTitle?: string;
}

export function renderTemplateSvg(kind: "logo" | "banner" | "mascot", input: ArtInput): string {
  if (kind === "logo") return renderLogoSvg(input);
  if (kind === "mascot") return renderMascotSvg(input);
  return renderBannerSvg({ ...input, narrativeTitle: input.narrativeTitle ?? input.name });
}

export function renderLogoSvg(input: ArtInput): string {
  const label = xmlEscape(input.ticker.slice(0, 8));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img" aria-label="${xmlEscape(input.name)} logo">
  ${defs(input.palette)}
  <rect width="1024" height="1024" rx="220" fill="url(#sky)"/>
  <circle cx="512" cy="430" r="300" fill="url(#glow)" opacity="0.9"/>
  ${character(input.motif, input.palette, 512, 470, 1.05)}
  <rect x="262" y="790" width="500" height="128" rx="64" fill="${input.palette.bg}" opacity="0.72"/>
  <text x="512" y="874" text-anchor="middle" font-family="ui-sans-serif, sans-serif" font-size="72" font-weight="700" fill="${input.palette.fg}">${label}</text>
</svg>`;
}

export function renderMascotSvg(input: ArtInput): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img" aria-label="${xmlEscape(input.name)} mascot">
  ${defs(input.palette)}
  <rect width="1024" height="1024" rx="80" fill="url(#sky)"/>
  <ellipse cx="512" cy="860" rx="280" ry="46" fill="${input.palette.bg}" opacity="0.45"/>
  ${sparkles(input.palette)}
  ${character(input.motif, input.palette, 512, 500, 1.35)}
</svg>`;
}

export function renderBannerSvg(input: ArtInput & { narrativeTitle: string }): string {
  const name = xmlEscape(input.name);
  const ticker = xmlEscape(input.ticker);
  const title = xmlEscape(truncate(input.narrativeTitle, 78));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 500" width="1500" height="500" role="img" aria-label="${name} banner">
  ${defs(input.palette)}
  <rect width="1500" height="500" fill="url(#sky)"/>
  <circle cx="1180" cy="80" r="180" fill="${input.palette.accent}" opacity="0.18"/>
  <circle cx="1320" cy="420" r="140" fill="${input.palette.ink}" opacity="0.2"/>
  ${character(input.motif, input.palette, 250, 270, 0.72)}
  <text x="470" y="190" font-family="ui-sans-serif, sans-serif" font-size="64" font-weight="700" fill="${input.palette.fg}">${name}</text>
  <rect x="470" y="214" width="${Math.max(120, ticker.length * 28)}" height="52" rx="26" fill="${input.palette.accent}"/>
  <text x="494" y="250" font-family="ui-sans-serif, sans-serif" font-size="28" font-weight="700" fill="${input.palette.bg}">${ticker}</text>
  <text x="470" y="340" font-family="ui-sans-serif, sans-serif" font-size="28" fill="${input.palette.ink}">${title}</text>
</svg>`;
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 1)}…`;
}

function defs(palette: Palette): string {
  return `<defs>
    <radialGradient id="sky" cx="50%" cy="35%" r="75%">
      <stop offset="0%" stop-color="${palette.ink}"/>
      <stop offset="55%" stop-color="${palette.bg}"/>
      <stop offset="100%" stop-color="${palette.bg}"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="${palette.accent}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${palette.accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fur" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette.fg}"/>
      <stop offset="100%" stop-color="${palette.accent}"/>
    </linearGradient>
  </defs>`;
}

function sparkles(palette: Palette): string {
  return `<g fill="${palette.fg}">
    <circle cx="180" cy="180" r="8"/><circle cx="250" cy="120" r="4"/>
    <circle cx="820" cy="160" r="10"/><circle cx="760" cy="240" r="5"/>
    <circle cx="860" cy="320" r="6"/>
  </g>`;
}

function character(motif: Motif, palette: Palette, x: number, y: number, scale: number): string {
  const fur = "url(#fur)";
  const ink = palette.bg;
  const paper = palette.fg;
  const accent = palette.accent;
  const blush = palette.ink;
  const ears = earsFor(motif, accent, ink, paper);
  const faceExtra = extraFor(motif, accent, ink, paper);
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <ellipse cx="0" cy="150" rx="92" ry="28" fill="${ink}" opacity="0.25"/>
    <ellipse cx="0" cy="78" rx="108" ry="92" fill="${fur}"/>
    <ellipse cx="-78" cy="96" rx="28" ry="18" fill="${accent}" transform="rotate(-18 -78 96)"/>
    <ellipse cx="78" cy="96" rx="28" ry="18" fill="${accent}" transform="rotate(18 78 96)"/>
    <ellipse cx="-46" cy="168" rx="32" ry="16" fill="${paper}"/>
    <ellipse cx="46" cy="168" rx="32" ry="16" fill="${paper}"/>
    ${ears}
    <ellipse cx="0" cy="-8" rx="112" ry="104" fill="${fur}"/>
    <ellipse cx="0" cy="28" rx="48" ry="36" fill="${paper}"/>
    <ellipse cx="0" cy="18" rx="16" ry="12" fill="${ink}"/>
    <ellipse cx="-40" cy="-16" rx="22" ry="26" fill="${paper}"/>
    <ellipse cx="40" cy="-16" rx="22" ry="26" fill="${paper}"/>
    <ellipse cx="-36" cy="-12" rx="10" ry="12" fill="${ink}"/>
    <ellipse cx="44" cy="-12" rx="10" ry="12" fill="${ink}"/>
    <circle cx="-32" cy="-18" r="4" fill="${paper}"/>
    <circle cx="48" cy="-18" r="4" fill="${paper}"/>
    <path d="M-22 42 Q0 62 22 42" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="-70" cy="24" rx="16" ry="10" fill="${blush}" opacity="0.85"/>
    <ellipse cx="70" cy="24" rx="16" ry="10" fill="${blush}" opacity="0.85"/>
    ${faceExtra}
    <g transform="translate(78 20) rotate(18)">
      <polygon points="0,-28 16,8 0,2 -16,8" fill="${accent}" stroke="${paper}" stroke-width="4"/>
    </g>
  </g>`;
}

function earsFor(motif: Motif, accent: string, ink: string, paper: string): string {
  if (motif === "robot" || motif === "circuit" || motif === "rocket") {
    return `<rect x="-18" y="-150" width="36" height="48" rx="12" fill="${accent}"/>
      <circle cx="0" cy="-156" r="14" fill="${paper}" stroke="${ink}" stroke-width="4"/>`;
  }
  if (motif === "frog") {
    return `<ellipse cx="-70" cy="-78" rx="34" ry="28" fill="${paper}"/>
      <ellipse cx="70" cy="-78" rx="34" ry="28" fill="${paper}"/>
      <ellipse cx="-70" cy="-78" rx="14" ry="14" fill="${ink}"/>
      <ellipse cx="70" cy="-78" rx="14" ry="14" fill="${ink}"/>`;
  }
  if (motif === "star") {
    return `<polygon points="-78,-40 -118,-130 -28,-78" fill="${accent}"/>
      <polygon points="78,-40 118,-130 28,-78" fill="${accent}"/>
      <polygon points="-70,-62 -96,-112 -42,-82" fill="${paper}"/>
      <polygon points="70,-62 96,-112 42,-82" fill="${paper}"/>`;
  }
  if (motif === "cloud") {
    return `<ellipse cx="-36" cy="-108" rx="46" ry="28" fill="${paper}"/>
      <ellipse cx="40" cy="-112" rx="42" ry="26" fill="${paper}"/>`;
  }
  return `<polygon points="-78,-36 -126,-150 -22,-86" fill="${accent}"/>
    <polygon points="78,-36 126,-150 22,-86" fill="${accent}"/>
    <polygon points="-72,-58 -104,-128 -40,-84" fill="${paper}"/>
    <polygon points="72,-58 104,-128 40,-84" fill="${paper}"/>`;
}

function extraFor(motif: Motif, accent: string, ink: string, paper: string): string {
  if (motif === "robot" || motif === "circuit") {
    return `<rect x="-58" y="-28" width="116" height="36" rx="12" fill="none" stroke="${ink}" stroke-width="6"/>`;
  }
  if (motif === "rocket") {
    return `<path d="M-90 70 L-130 20 L-78 78 Z" fill="${accent}"/><path d="M90 70 L130 20 L78 78 Z" fill="${accent}"/>`;
  }
  if (motif === "star") {
    return `<circle cx="0" cy="-118" r="10" fill="${paper}"/>`;
  }
  if (motif === "frog") {
    return `<ellipse cx="-92" cy="110" rx="22" ry="14" fill="${paper}"/><ellipse cx="92" cy="110" rx="22" ry="14" fill="${paper}"/>`;
  }
  return `<path d="M-34 108 H34" stroke="${paper}" stroke-width="8" stroke-linecap="round"/>`;
}

export function assertTemplateSvg(svg: string): void {
  if (/<script|foreignObject|<!ENTITY|javascript:|onload=/i.test(svg)) {
    throw new Error("Template SVG contains a disallowed primitive.");
  }
}
