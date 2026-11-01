import { Check, Menu, X } from 'lucide-react';
import { SchemaMark } from '../src/components/SchemaMark';
import { AuthButtons } from '../src/components/AuthButtons';
import './landing.css';

const nav = [
  { href: '#product', label: 'Product' },
  { href: '#how', label: 'How it works' },
  { href: '#trust', label: 'Trust & control' },
  { href: '/studio', label: 'Studio' },
];

const capabilities = [
  { title: 'From brief to evidence', text: 'Upload the brief and your PDFs. Schema reads them page by page, keeps the page reference for every claim, and lists unread or scanned pages instead of guessing.' },
  { title: 'One model, two views', text: 'A single commercial concept drives the editable floor plan and the 3D cutaway. Geometry checks keep rooms inside the suite and out of each other.' },
  { title: 'You make the decisions', text: 'The agent runs the internal work queue. Meaningful decisions, and anything that leaves the workspace, stop at an approval gate.' },
];

const stages = [
  { title: 'Understand', text: 'Reads the brief and PDFs, states its assumptions and lists what is missing.', gate: 'Approve the understanding' },
  { title: 'Design & strategy', text: 'Builds the concept and a sourced permit strategy. Unknowns stay visible.', gate: 'Approve the design and strategy' },
  { title: 'Prepare', text: 'Consolidates open questions into one request and prepares coordination work.', gate: 'Approve the package' },
  { title: 'Handoff', text: 'An independent review pass, then a reviewed package you can export.', gate: 'Export the handoff' },
];

const control = [
  'Every stage ends at an approval gate you control',
  'Feedback reopens affected work and marks dependent approvals stale',
  'Hard limits per stage: 12 model requests, 24 tool actions, 60 minutes',
  'Email is sent only after you approve the exact recipient, content and attachments',
  'Editable preference records, with the decision they came from and deletion',
  'Standalone HTML handoff and project JSON export',
];

const limits = [
  'Does not issue permits or establish legal compliance',
  'Does not replace professional sign-off or engineering simulation',
  'Does not generate complete professional drawings',
  'Does not hide missing evidence; it is listed in the handoff',
];

/** Concept plan of the fictional 60 × 40 ft suite. 7.2 px per foot. */
function PlanSheet() {
  return (
    <svg className="lp-plan" viewBox="0 0 640 410" role="img" aria-label="Concept floor plan of a 60 by 40 foot office suite with an open workspace, a meeting room and two quiet offices">
      <defs>
        <pattern id="lp-grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="#d5dad9" strokeWidth=".6" /></pattern>
      </defs>
      <rect width="640" height="410" fill="url(#lp-grid)" />
      <g className="lp-dim" fill="none" stroke="#5b6872" strokeWidth="1">
        <path d="M120 50H552M120 42V58M552 42V58" />
        <path d="M84 80V368M76 80H92M76 368H92" />
      </g>
      <text x="336" y="40" textAnchor="middle" className="lp-dim-label">60′-0″</text>
      <text x="62" y="224" textAnchor="middle" className="lp-dim-label" transform="rotate(-90 62 224)">40′-0″</text>

      <g className="lp-walls" fill="none" stroke="#14212b" strokeLinecap="square">
        <path pathLength="1" strokeWidth="4" d="M120 80H552V368H120Z" />
        <path pathLength="1" strokeWidth="2.5" d="M365 80V120M365 160V368" />
        <path pathLength="1" strokeWidth="2.5" d="M365 224H382M410 224H478M506 224H552" />
        <path pathLength="1" strokeWidth="2.5" d="M458 224V368" />
      </g>
      <g fill="none" stroke="#5b6872" strokeWidth="1">
        <path d="M365 120A40 40 0 0 1 405 160" strokeDasharray="3 3" />
        <path d="M382 224A28 28 0 0 0 410 252" strokeDasharray="3 3" />
        <path d="M478 224A28 28 0 0 0 506 252" strokeDasharray="3 3" />
      </g>
      <g className="lp-desks" fill="#fff" stroke="#8b979f" strokeWidth="1.2">
        {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => (
          <rect key={`${r}-${c}`} x={146 + c * 70} y={150 + r * 62} width="46" height="22" />
        )))}
        <rect x="396" y="108" width="110" height="46" />
      </g>
      <g className="lp-room-label">
        <text x="136" y="108">Open workspace</text>
        <text x="381" y="104">Meeting room</text>
        <text x="381" y="276">Office</text>
        <text x="474" y="276">Office</text>
      </g>
      <g className="lp-gate-mark" transform="translate(365 140)">
        <rect x="-8" y="-8" width="16" height="16" transform="rotate(45)" fill="#c8561b" />
      </g>
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="lp">
      <a className="lp-skip" href="#main">Skip to content</a>

      <header className="lp-header">
        <div className="lp-wrap lp-nav">
          <a className="lp-brand" href="/" aria-label="Schema home">
            <SchemaMark size={26} />
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
                <a href="/login">Log in</a>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy">
              <h1>The autonomous project agent for commercial fit-outs.</h1>
              <p className="lp-lede">Start with a brief and your PDFs. Schema builds the understanding, a linked 2D/3D concept, a permit strategy and a reviewed handoff. You approve every decision that matters.</p>
              <div className="lp-cta">
                <a className="btn btn-primary btn-lg" href="/register">Create free account</a>
                <a className="btn btn-ghost btn-lg" href="#how">See how it works</a>
              </div>
              <p className="lp-fine">Sign in with an email link. No card required.</p>
            </div>

            <figure className="lp-sheet">
              <PlanSheet />
              <figcaption className="lp-titleblock">
                <div><small>Project</small><b>Portland office fit-out</b><span>Fictional example</span></div>
                <div><small>Concept</small><b>60′ × 40′ suite</b><span>Plan and 3D cutaway</span></div>
                <div><small>Status</small><b className="lp-status"><i aria-hidden="true" />Awaiting your approval</b><span>Meeting room layout</span></div>
              </figcaption>
            </figure>
          </div>
        </section>

        <section id="product" className="lp-section">
          <div className="lp-wrap">
            <h2>Coordination work, handled. Judgment, kept.</h2>
            <p className="lp-sub">Repetitive commercial project coordination is where architects and contractors lose days. Schema takes the queue, not the call.</p>
            <div className="lp-cols">
              {capabilities.map(({ title, text }) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="lp-section lp-alt">
          <div className="lp-wrap">
            <h2>Four stages, each ending at your approval</h2>
            <p className="lp-sub">The agent progresses on its own, then stops where a human decision is needed.</p>
            <ol className="lp-rail">
              {stages.map((s, i) => (
                <li key={s.title}>
                  <span className="lp-node" aria-hidden="true">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                  <span className="lp-gate"><i aria-hidden="true" />{s.gate}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="trust" className="lp-section">
          <div className="lp-wrap">
            <h2>Built to be checked</h2>
            <p className="lp-sub">Professional work needs an audit trail. Schema shows its evidence, keeps its limits visible and never acts outside the workspace without you.</p>
            <div className="lp-two">
              <div className="lp-list">
                <h3>Under your control</h3>
                <ul>{control.map((t) => <li key={t}><Check size={18} aria-hidden="true" /><span>{t}</span></li>)}</ul>
              </div>
              <div className="lp-list lp-list-limits">
                <h3>What Schema does not do</h3>
                <ul>{limits.map((t) => <li key={t}><X size={18} aria-hidden="true" /><span>{t}</span></li>)}</ul>
              </div>
            </div>
            <p className="lp-footnote">The example project is fictional, and city approval is never simulated.</p>
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
            <a href="/studio">Studio</a>
            <a href="/legacy">Earlier tools</a>
          </nav>
          <p>Schema supports professionals and does not issue permits or provide legal or engineering sign-off.</p>
        </div>
      </footer>
    </div>
  );
}
