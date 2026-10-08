import { describe, expect, it } from "vitest";
import { pickPalette, renderTemplateSvg } from "../src/assets";
import { buildVisualBrief, displayTicker } from "../src/visual-brief";

const palette = pickPalette("brief");

describe("visual brief templates", () => {
  it("turns a robot story into a folder-carrying mascot and brands the logo and banner", () => {
    const brief = buildVisualBrief({
      narrativeId: "nar_robot",
      title: "Lisbon robot files its own municipal tax form",
      name: "Lisbonlet",
      ticker: "$LSBNLT",
    });
    expect(brief.label).toBe("Template concept");
    expect(brief.species).toBe("small round robot");
    expect(brief.signature).toBe("task folder");
    expect(brief.displayTicker).toBe("$LSBNLT");
    expect(displayTicker("$$LSBNLT")).toBe("$LSBNLT");
    expect(brief.unwanted).toContain("endorsement seal");

    const art = { motif: brief.motif, palette, name: brief.name, ticker: brief.ticker, narrativeTitle: brief.catalyst, brief };
    const mascot = renderTemplateSvg("mascot", art);
    const logo = renderTemplateSvg("logo", art);
    const banner = renderTemplateSvg("banner", art);
    expect(mascot).toContain('viewBox="0 0 1024 1024"');
    expect(mascot).not.toContain("<text");
    expect(mascot).toContain('data-signature="task folder"');
    expect(logo).toContain('viewBox="0 0 1024 1024"');
    expect(logo).toContain("Lisbonlet");
    expect(logo).toContain("$LSBNLT");
    expect(banner).toContain('viewBox="0 0 1500 500"');
    expect(banner).toContain("Lisbonlet");
    expect(banner).toContain("$LSBNLT");
    expect(logo.match(/\$/g)?.length).toBe(1);
  });

  it("keeps a long punctuated name intact and avoids a celebrity portrait", () => {
    const name = "Museum & Signal";
    const brief = buildVisualBrief({
      narrativeId: "nar_museum",
      title: "Vitalik Buterin opens a museum for on-chain art",
      name,
      ticker: "MSIG",
    });
    expect(brief.species).toBe("tiny curator");
    expect(brief.unwanted.some((item) => item.includes("Vitalik Buterin"))).toBe(true);
    expect(brief.hook.toLowerCase()).not.toContain("endorses");
    const logo = renderTemplateSvg("logo", { motif: brief.motif, palette, name, ticker: "MSIG", narrativeTitle: brief.catalyst, brief });
    expect(logo).toContain("Museum &amp; Signal");
    expect(logo).not.toContain("Museum…");
  });
});
