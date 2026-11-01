import { ArrowRight, Check, FileText, Layers, Menu, ShieldCheck, X } from 'lucide-react';
import { SchemaMark } from '../src/components/SchemaMark';
import { AuthButtons } from '../src/components/AuthButtons';
import './landing.css';

const SOURCE = 'https://github.com/RAWCoder123/groundwork-meta-hackathon';

const nav = [
  { href: '#product', label: 'Product' },
  { href: '#how', label: 'How it works' },
  { href: '#trust', label: 'Trust & control' },
  { href: '#hackathon', label: 'Hackathon' },
];

const value = [
  { icon: FileText, title: 'From brief to evidence', text: 'Upload the brief and PDFs. Schema reads them page by page, keeps page-level provenance, and keeps unread or scanned pages visible instead of guessing.' },
  { icon: Layers, title: 'One model, two views', text: 'A single commercial concept drives the editable floor plan and the 3D cutaway. Geometry checks enforce boundaries and non-overlap.' },
  { icon: ShieldCheck, title: 'You make the decisions', text: 'The agent runs the internal work queue. Meaningful decisions, and anything that leaves the workspace, stop at an approval gate.' },
];

const steps = [
  { n: '01', title: 'Understand', text: 'Reads the brief and PDFs, declares assumptions and lists what is missing.' },
  { n: '02', title: 'Design & strategy', text: 'Builds the concept and a sourced permit strategy. Unknowns stay visible.' },
  { n: '03', title: 'Prepare', text: 'Consolidates questions into one request and prepares coordination work.' },
  { n: '04', title: 'Handoff', text: 'An independent review pass, then a reviewed package you can export.' },
];

const control = [
  'Every stage ends at an approval gate you control',
  'Feedback reopens affected work and marks dependent approvals stale',
  'Hard budgets per stage: 12 model requests, 24 tool actions, 60 minutes',
  'Email is sent only after you approve the exact recipient, content and attachments',
  'Editable preference records with decision provenance and deletion',
  'Standalone HTML handoff and project JSON export',
];

const limits = [
  'Does not issue permits or establish legal compliance',
  'Does not replace professional sign-off or engineering simulation',
  'Does not generate complete professional drawings',
  'Does not hide missing evidence. It is listed in the handoff',
];

export default function LandingPage() {
  return (
    <div className="lp">
      <a className="lp-skip" href="#main">Skip to content</a>

      <header className="lp-header">
        <div className="lp-wrap lp-nav">
          <a className="lp-brand" href="/" aria-label="Schema home">
            <SchemaMark size={28} />
            <span>Schema</span>
          </a>
          <nav className="lp-links" aria-label="Primary">
            {nav.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
          </nav>
          <div className="lp-actions">
            <AuthButtons />
            <details className="lp-menu">
              <summary aria-label="Open menu"><Menu size={20} /></summary>
              <div className="lp-menu-panel">
                {nav.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
                <a href="/legacy">Legacy permit desk</a>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy">
              <p className="lp-eyebrow"><span className="lp-pulse" aria-hidden="true" />Meta Global AI Developer Hackathon · Build for Your World</p>
              <h1>The autonomous project agent for commercial fit-outs.</h1>
              <p className="lp-lede">Start with a brief and your PDFs. Schema builds the understanding, a linked 2D/3D concept, a permit strategy and a reviewed handoff. You approve every decision that matters.</p>
              <div className="lp-cta">
                <a className="btn btn-primary btn-lg" href="/register">Create free account <ArrowRight size={18} /></a>
                <a className="btn btn-ghost btn-lg" href="#how">See how it works</a>
              </div>
              <p className="lp-fine">Passwordless. Sign in with an email link. No card required.</p>
            </div>

            <div className="lp-mock" role="img" aria-label="Illustration of the Schema workspace showing four stages, a project message and a decision awaiting approval. Fictional Portland office fit-out.">
              <div className="lp-mock-bar"><i /><i /><i /><span>Portland office fit-out · fictional example</span></div>
              <div className="lp-mock-body">
                <ol className="lp-mock-stages">
                  <li className="done"><b>Understand</b><small>Approved</small></li>
                  <li className="live"><b>Design &amp; strategy</b><small>In progress</small></li>
                  <li><b>Prepare</b><small>Queued</small></li>
                  <li><b>Handoff</b><small>Queued</small></li>
                </ol>
                <div className="lp-mock-main">
                  <div className="lp-bubble"><strong>Schema</strong><p>I read 3 PDFs. The concept fits the 60 × 40 ft suite. Two items need your confirmation before I continue.</p></div>
                  <div className="lp-evidence"><span>Brief · p. 2</span><span>Check sheet · p. 7</span><span className="warn">1 page unread</span></div>
                  <div className="lp-decision">
                    <div><small>Decision</small><b>Approve the current understanding</b></div>
                    <div className="lp-decision-actions"><span className="btn-mini ok">Approve</span><span className="btn-mini">Request change</span></div>
                  </div>
                  <div className="lp-budget"><span>Stage budget</span><div><i /></div></div>
                </div>
              </div>
              <p className="lp-mock-note">Illustrative interface</p>
            </div>
          </div>
        </section>

        <section className="lp-stats" aria-label="Key facts">
          <div className="lp-wrap lp-stats-grid">
            <div><b>4</b><span>stages, each with an approval gate</span></div>
            <div><b>8 × 50</b><span>PDFs and pages per project</span></div>
            <div><b>2D + 3D</b><span>one model, linked views</span></div>
            <div><b>100%</b><span>outbound actions need your approval</span></div>
          </div>
        </section>

        <section id="product" className="lp-section">
          <div className="lp-wrap">
            <h2>Coordination work, handled. Judgment, kept.</h2>
            <p className="lp-sub">Repetitive commercial project coordination is where architects and contractors lose days. Schema takes the queue, not the call.</p>
            <div className="lp-grid3">
              {value.map(({ icon: Icon, title, text }) => (
                <article className="lp-card" key={title}>
                  <span className="lp-icon"><Icon size={20} /></span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="lp-section lp-alt">
          <div className="lp-wrap">
            <h2>How it works</h2>
            <p className="lp-sub">Four stages. The agent progresses on its own, then stops where a human decision is needed.</p>
            <ol className="lp-steps">
              {steps.map((s) => (
                <li key={s.n}><span>{s.n}</span><h3>{s.title}</h3><p>{s.text}</p></li>
              ))}
            </ol>
          </div>
        </section>

        <section id="trust" className="lp-section">
          <div className="lp-wrap">
            <h2>Built to be checked</h2>
            <p className="lp-sub">Professional work needs an audit trail. Schema shows its evidence, keeps its limits visible and never acts outside the workspace without you.</p>
            <div className="lp-two">
              <div className="lp-panel">
                <h3>Under your control</h3>
                <ul>{control.map((t) => <li key={t}><Check size={18} aria-hidden="true" /><span>{t}</span></li>)}</ul>
              </div>
              <div className="lp-panel lp-panel-muted">
                <h3>What Schema does not do</h3>
                <ul>{limits.map((t) => <li key={t}><X size={18} aria-hidden="true" /><span>{t}</span></li>)}</ul>
              </div>
            </div>
          </div>
        </section>

        <section id="hackathon" className="lp-section lp-alt">
          <div className="lp-wrap lp-hack">
            <div>
              <h2>For hackathon judges</h2>
              <p className="lp-sub">Built for the Meta Global AI Developer Hackathon. Run on Meta’s Muse Spark model with document inputs, search grounding and validated tools.</p>
              <ol className="lp-quick">
                <li><b>Register</b> with your email. You receive a sign-in link, no password.</li>
                <li><b>Open the workspace</b> and start the prepared fictional Portland office example.</li>
                <li><b>Review the decisions</b>, linked 2D/3D concept and the handoff package.</li>
              </ol>
              <div className="lp-cta">
                <a className="btn btn-primary btn-lg" href="/register">Register to try it</a>
                <a className="btn btn-ghost btn-lg" href={SOURCE} rel="noopener noreferrer">View source</a>
              </div>
            </div>
            <div className="lp-note">
              <h3>Honest status</h3>
              <p>The workflow is implemented and tested. Live acceptance of every integration is tracked separately in the repository docs, and the example project is fictional. City approval is never simulated.</p>
            </div>
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-wrap">
            <h2>Give your next fit-out an agent that shows its work.</h2>
            <div className="lp-cta lp-cta-center"><AuthButtons size="lg" /></div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-foot">
          <a className="lp-brand" href="/"><SchemaMark size={22} /><span>Schema</span></a>
          <nav aria-label="Footer">
            <a href="/login">Log in</a>
            <a href="/register">Register</a>
            <a href="/legacy">Legacy permit desk</a>
            <a href={SOURCE} rel="noopener noreferrer">Source</a>
          </nav>
          <p>Schema supports professionals and does not issue permits or provide legal or engineering sign-off.</p>
        </div>
      </footer>
    </div>
  );
}
