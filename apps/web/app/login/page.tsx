import { LoginForm } from "./form";

export default function LoginPage() {
  const showHint = process.env.DEMO_SHOW_LOGIN_HINT === "true";
  return (
    <main className="mx-auto grid min-h-screen max-w-5xl items-center gap-10 px-6 py-16 md:grid-cols-2">
      <section>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-mint">Private research desk</p>
        <h1 className="display mt-3 text-5xl leading-tight">Narrative Radar</h1>
        <p className="mt-4 max-w-md text-lg text-muted">
          Watch fresh stories, culture, and Ethereum-adjacent signals, then sketch a name, ticker, and a small picture. Nothing here launches a token or predicts a price.
        </p>
        <ul className="mt-6 space-y-2 text-sm text-muted">
          <li>One owner. Public sign-up is off.</li>
          <li>Demo mode uses labeled fixtures and does not call paid APIs.</li>
          <li>The worker keeps scanning after you close the tab, as long as this computer stays on.</li>
        </ul>
      </section>
      <section className="rounded-3xl border border-line bg-card p-6 shadow-[var(--shadow)]">
        <h2 className="display text-2xl">Sign in</h2>
        <p className="mb-5 mt-1 text-sm text-muted">This desk is for the configured owner only.</p>
        <LoginForm />
        {showHint ? (
          <p className="mt-4 rounded-2xl bg-background p-3 text-sm text-muted">
            Local hint: {process.env.OWNER_EMAIL} / {process.env.OWNER_PASSWORD}. Turn DEMO_SHOW_LOGIN_HINT off before anyone else can open this page.
          </p>
        ) : null}
      </section>
    </main>
  );
}
