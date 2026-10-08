import { redirect } from "next/navigation";

export default function Home() {
  if (process.env.GITHUB_PAGES === "1") {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <meta httpEquiv="refresh" content="0; url=/radar/" />
        <h1 className="display text-4xl">Narrative Radar</h1>
        <p className="mt-3 text-sm text-muted">Opening the research desk.</p>
        <a className="mt-6 inline-block underline" href="/radar/">Continue to Live Radar</a>
      </main>
    );
  }
  redirect("/radar");
}
