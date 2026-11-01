import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SchemaMark } from "./SchemaMark";
import "../studio/studio.css";
import {
  CLIMATES, ELEMENTS, MATERIALS, THRESHOLDS, allowedMaterials, analyzeCodes, buildPermitPackage, compareMaterials,
  fetchObservedClimate, listJurisdictions, parseIdea, planSubmission, renderPackageMarkdown, reshapeSpec,
  resolveClimate, runWorkflowFromParsed, simulate, stressLabel, withCoastal,
  type BuildingSpec, type Climate, type DocId, type ElementKey, type Maintenance, type MaterialId, type PackageInputs, type ParsedIdea,
  type RoofType, type SimulationResult, type WorkflowResult,
} from "../studio";

const StudioScene = lazy(() => import("./StudioScene"));

const STEPS = ["Idea", "Model", "Simulate", "Codes and permits", "Package"] as const;
const EXAMPLES = [
  "A 2-storey timber house, 200 sqm, in an area with extreme humidity and heavy rainfall",
  "A 5-storey apartment building in Nairobi, 3,000 m2, concrete frame",
  "A coastal 3-storey office in Miami with a steel frame and flat roof",
  "A 2-storey brick school, 2,400 m2, in Portland",
  "A steel warehouse in Dubai, 5,000 sqm",
];
const COLORS: Record<ElementKey | "overall", string> = { structure: "#44543c", facade: "#826137", roof: "#4f7c8a", overall: "#29342c" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const grade = (v: number) => (v >= THRESHOLDS.watch ? "good" : v >= THRESHOLDS.action ? "fair" : "poor");

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function StudioApp() {
  const [step, setStep] = useState(0);
  const [idea, setIdea] = useState(EXAMPLES[0]);
  const [parsed, setParsed] = useState<ParsedIdea | null>(null);
  const [spec, setSpec] = useState<BuildingSpec | null>(null);
  const [log, setLog] = useState<WorkflowResult["log"]>([]);
  const [climateId, setClimateId] = useState("");
  const [observed, setObserved] = useState<Climate | null>(null);
  const [weatherStatus, setWeatherStatus] = useState("");
  const [years, setYears] = useState(30);
  const [maintenance, setMaintenance] = useState<Maintenance>("none");
  const [year, setYear] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rainOn, setRainOn] = useState(true);
  const [revision, setRevision] = useState<WorkflowResult | null>(null);
  const [jurisdictionId, setJurisdictionId] = useState("");
  const [inputs, setInputs] = useState<PackageInputs>({});
  const [approvals, setApprovals] = useState({ designApproved: false, packageApproved: false });

  const climate = useMemo(() => {
    if (!spec) return null;
    if (observed) return withCoastal(observed, spec.coastal);
    return resolveClimate({ ...spec, climateId: climateId || spec.climateId }, CLIMATES);
  }, [spec, climateId, observed]);
  const sim = useMemo(() => (spec && climate ? simulate(spec, climate, { years, maintenance }) : null), [spec, climate, years, maintenance]);
  const analysis = useMemo(() => (spec && climate ? analyzeCodes(spec, climate, jurisdictionId || spec.location.jurisdictionId) : null), [spec, climate, jurisdictionId]);
  const pkg = useMemo(() => (spec && analysis ? buildPermitPackage(spec, analysis, sim ?? undefined, inputs) : null), [spec, analysis, sim, inputs]);
  const plan = useMemo(() => (analysis && pkg ? planSubmission(analysis, pkg, approvals) : []), [analysis, pkg, approvals]);

  // A changed design invalidates earlier approvals and any agent revision proposal.
  useEffect(() => { setApprovals({ designApproved: false, packageApproved: false }); setRevision(null); }, [spec]);
  useEffect(() => { setYear((y) => Math.min(y, years)); }, [years]);

  // Time-lapse
  const reduced = useRef(false);
  useEffect(() => { reduced.current = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches; }, []);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setYear((y) => {
        const next = y + (reduced.current ? 1 : 0.12);
        if (next >= years) { setPlaying(false); return years; }
        return next;
      });
    }, reduced.current ? 450 : 40);
    return () => clearInterval(id);
  }, [playing, years]);

  function build() {
    const p = parseIdea(idea);
    const w = runWorkflowFromParsed(p, { years, maintenance, autoRevise: false });
    setParsed(p); setSpec(p.spec); setLog(w.log); setClimateId(""); setObserved(null); setJurisdictionId("");
    setYear(0); setPlaying(false); setStep(1);
  }
  const edit = (change: Partial<BuildingSpec>) => spec && setSpec({ ...spec, ...change });
  const setMaterial = (el: ElementKey, id: MaterialId) => spec && setSpec({ ...spec, materials: { ...spec.materials, [el]: id } });

  async function loadWeather() {
    if (!spec || spec.location.lat === undefined || spec.location.lng === undefined) return;
    setWeatherStatus("Loading weather history…");
    try {
      setObserved(await fetchObservedClimate(spec.location.lat, spec.location.lng, 2024, `Observed weather, ${spec.location.label}`));
      setWeatherStatus("Using observed weather for 2024.");
    } catch (e) { setWeatherStatus((e as Error).message); }
  }
  function agentsRevise() {
    if (!parsed || !spec || !climate) return;
    setRevision(runWorkflowFromParsed({ ...parsed, spec }, { years, maintenance, climate, autoRevise: true }));
  }

  const ready = !!(spec && sim && climate && analysis && pkg);

  return (
    <div className="st-shell">
      <header className="st-top">
        <a className="st-brand" href="/"><SchemaMark size={22} /><span>Schema Studio</span></a>
        <nav aria-label="Steps" className="st-steps">
          {STEPS.map((label, i) => (
            <button key={label} className="st-step" aria-current={i === step ? "step" : undefined}
              data-done={ready && i < step} disabled={i > 0 && !ready} onClick={() => setStep(i)}>
              <span className="st-step-n">{i + 1}</span><span className="st-step-l">{label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="st-main">
        {step === 0 && (
          <section className="st-panel st-narrow" aria-labelledby="t-idea">
            <h1 id="t-idea">Describe what you want to build</h1>
            <p className="st-lede">Say what it is, how big, where, and what the weather is like. Schema turns that into a 3D model, ages it over decades, and lists the codes and permits to prepare.</p>
            <label className="st-label" htmlFor="idea">Your idea</label>
            <textarea id="idea" rows={4} value={idea} onChange={(e) => setIdea(e.target.value)} />
            <div className="st-chips" role="group" aria-label="Examples">
              {EXAMPLES.map((e) => <button key={e} className="st-chip" onClick={() => setIdea(e)}>{e.length > 52 ? `${e.slice(0, 50)}…` : e}</button>)}
            </div>
            <div className="st-row">
              <button className="st-btn st-primary" disabled={idea.trim().length < 8} onClick={build}>Build the model</button>
              {ready && <button className="st-btn" onClick={() => setStep(1)}>Back to my model</button>}
            </div>
            {ready && parsed && (
              <div className="st-understood">
                <h2>What Schema understood</h2>
                <ul className="st-tags">{parsed.found.map((f) => <li key={f}>{f}</li>)}</ul>
                {parsed.assumptions.length > 0 && <><h3>Assumed, so check these</h3><ul className="st-list">{parsed.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></>}
                <Log events={log} />
              </div>
            )}
          </section>
        )}

        {step === 1 && ready && (
          <div className="st-split">
            <ScenePane spec={spec} sim={sim} year={0} rainOn={rainOn} setRainOn={setRainOn} caption="Concept massing at completion. Drag to orbit, pinch or scroll to zoom." />
            <section className="st-panel" aria-labelledby="t-model">
              <h1 id="t-model">{spec.name}</h1>
              <p className="st-lede">{spec.location.label}. {spec.storeys} storeys, {spec.widthM} × {spec.depthM} × {spec.heightM} m, about {spec.occupancy} occupants.</p>
              <div className="st-grid2">
                <Field label="Storeys"><input type="number" min={1} max={60} value={spec.storeys} onChange={(e) => setSpec(reshapeSpec(spec, { storeys: Number(e.target.value) || 1 }))} /></Field>
                <Field label="Gross floor area (m²)"><input type="number" min={20} step={10} value={spec.grossFloorAreaM2} onChange={(e) => setSpec(reshapeSpec(spec, { grossFloorAreaM2: Number(e.target.value) || 20 }))} /></Field>
                <Field label="Roof">
                  <select value={spec.roof} onChange={(e) => setSpec(reshapeSpec(spec, { roof: e.target.value as RoofType }))}>
                    {(["flat", "gable", "hip", "shed"] as RoofType[]).map((r) => <option key={r} value={r}>{cap(r)}</option>)}
                  </select>
                </Field>
                <Field label="Site area (m²)"><input type="number" min={20} step={10} value={spec.siteAreaM2} onChange={(e) => edit({ siteAreaM2: Number(e.target.value) || 20 })} /></Field>
              </div>
              <h2>Materials</h2>
              <div className="st-grid3">
                {ELEMENTS.map((el) => (
                  <Field key={el} label={cap(el)}>
                    <select value={spec.materials[el]} onChange={(e) => setMaterial(el, e.target.value as MaterialId)}>
                      {allowedMaterials(el).map((m) => <option key={m} value={m}>{MATERIALS[m].label}</option>)}
                    </select>
                  </Field>
                ))}
              </div>
              <p className="st-note">This is a concept model for early decisions. It is not a permit drawing and does not replace an architect or engineer.</p>
              <NavButtons back={() => setStep(0)} next={() => setStep(2)} nextLabel="Simulate weathering" />
            </section>
          </div>
        )}

        {step === 2 && ready && (
          <div className="st-split">
            <div className="st-stack">
              <ScenePane spec={spec} sim={sim} year={year} rainOn={rainOn} setRainOn={setRainOn} caption={`Year ${year.toFixed(1)} of ${years}`} />
              <div className="st-timeline">
                <button className="st-btn st-primary" onClick={() => { if (year >= years) setYear(0); setPlaying(!playing); }}>{playing ? "Pause" : year >= years ? "Replay" : "Play time-lapse"}</button>
                <input aria-label="Year" type="range" min={0} max={years} step={0.1} value={year} onChange={(e) => { setPlaying(false); setYear(Number(e.target.value)); }} />
                <output>Year {year.toFixed(1)}</output>
              </div>
              <Chart sim={sim} year={year} />
            </div>
            <section className="st-panel" aria-labelledby="t-sim">
              <h1 id="t-sim">How it ages</h1>
              <p className="st-lede">{sim.summary}</p>
              <div className="st-grid3">
                <Field label="Climate">
                  <select value={observed ? "observed" : climateId || spec.climateId} onChange={(e) => { setObserved(null); setWeatherStatus(""); setClimateId(e.target.value); }}>
                    {observed && <option value="observed">{observed.label}</option>}
                    {Object.values(CLIMATES).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="Years"><select value={years} onChange={(e) => setYears(Number(e.target.value))}>{[10, 20, 30, 40, 50, 60].map((y) => <option key={y} value={y}>{y}</option>)}</select></Field>
                <Field label="Maintenance">
                  <select value={maintenance} onChange={(e) => setMaintenance(e.target.value as Maintenance)}>
                    <option value="none">None planned</option><option value="routine">Routine</option><option value="proactive">Proactive</option>
                  </select>
                </Field>
              </div>
              <div className="st-row">
                {spec.location.lat !== undefined && <button className="st-btn" onClick={loadWeather}>Use real weather for this site</button>}
                {weatherStatus && <span className="st-note" role="status">{weatherStatus}</span>}
              </div>
              <p className="st-note">{climate.source === "observed" ? "Based on one year of observed weather." : "Based on an indicative regional climate."} {Math.round(climate.annualRain)} mm rain, {Math.round(climate.meanRH)} % humidity, {climate.freezeThawDays} freeze-thaw days, {climate.hotDays} days above 32 °C{climate.coastal ? ", coastal salt" : ""}.</p>

              <h2>Problems to fix before breaking ground</h2>
              {sim.issues.length === 0 ? <p className="st-ok">No element drops below a watch level in {years} years.</p> : (
                <ul className="st-issues">
                  {sim.issues.map((i) => (
                    <li key={i.id} data-sev={i.severity}>
                      <strong>{i.title}</strong>
                      <span>{i.detail}</span>
                      <span className="st-fix">Fix: {i.recommendation}</span>
                    </li>
                  ))}
                </ul>
              )}
              <h2>Building risks</h2>
              <ul className="st-risks">{sim.risks.map((r) => <li key={r.id} data-level={r.level}><b>{r.title}</b> <i>{r.level}</i><span>{r.detail}</span></li>)}</ul>

              <h2>Compare materials</h2>
              <Compare spec={spec} sim={sim} years={years} maintenance={maintenance} onPick={setMaterial} />

              <h2>Let the agents revise</h2>
              <p className="st-note">The agent swaps weak facade and roof materials for the cheapest option that stays above 60/100, then re-runs the simulation. Frame changes are only proposed.</p>
              <button className="st-btn" onClick={agentsRevise}>Run agent revision</button>
              {revision && (
                <div className="st-revision">
                  <Log events={revision.log.filter((e) => e.agent === "Revision" || e.agent === "Simulation")} />
                  {revision.revisions.some((r) => r.applied) || revision.revisions.some((r) => !r.applied && r.to !== r.from) ? (
                    <div className="st-row">
                      <button className="st-btn st-primary" onClick={() => setSpec(revision.spec)}>Accept the changes</button>
                      {revision.revisions.filter((r) => !r.applied && r.to !== r.from).map((r) => (
                        <button key={r.element} className="st-btn" onClick={() => setMaterial(r.element, r.to)}>Change {r.element} to {MATERIALS[r.to].label.toLowerCase()}</button>
                      ))}
                    </div>
                  ) : <p className="st-ok">The current choices already meet the target.</p>}
                </div>
              )}
              <NavButtons back={() => setStep(1)} next={() => setStep(3)} nextLabel="Find codes and permits" />
            </section>
          </div>
        )}

        {step === 3 && ready && (
          <section className="st-panel st-wide" aria-labelledby="t-codes">
            <h1 id="t-codes">Codes and permits for {analysis.jurisdiction.label}</h1>
            <p className="st-note st-warn">{analysis.disclaimer}</p>
            <Field label="Jurisdiction">
              <select value={analysis.jurisdiction.id} onChange={(e) => setJurisdictionId(e.target.value)}>
                {listJurisdictions().map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
              </select>
            </Field>
            {analysis.designFlags.length > 0 && <><h2>Things that will shape the design</h2><ul className="st-list">{analysis.designFlags.map((f) => <li key={f}>{f}</li>)}</ul></>}
            <div className="st-cols">
              <div>
                <h2>Permits to prepare</h2>
                <ul className="st-cards">
                  {analysis.permits.map((p) => (
                    <li key={p.id}><b>{p.name}</b><span>{p.why}</span><small>{p.authority}. File via: {p.channel}</small></li>
                  ))}
                </ul>
              </div>
              <div>
                <h2>Codes likely to apply</h2>
                <ul className="st-cards">
                  {analysis.codes.map((c) => <li key={c.id}><b>{c.title}</b><span>{c.why}</span><small>{c.issuer}</small></li>)}
                </ul>
              </div>
            </div>
            <h2>Licensed professionals you will need</h2>
            <ul className="st-tags">{analysis.professionals.map((p) => <li key={p}>{p}</li>)}</ul>
            <NavButtons back={() => setStep(2)} next={() => setStep(4)} nextLabel="Prepare the package" />
          </section>
        )}

        {step === 4 && ready && (
          <section className="st-panel st-wide" aria-labelledby="t-pkg">
            <h1 id="t-pkg">Permit package</h1>
            <div className="st-meter" role="img" aria-label={`${pkg.completeness} percent of documents ready`}><span style={{ width: `${pkg.completeness}%` }} /></div>
            <p className="st-lede">{pkg.completeness} % of documents are drafted or provided. {pkg.openItems.length} need a person or a licensed professional.</p>

            <h2>Your details</h2>
            <div className="st-grid3">
              {([["applicantName", "Applicant"], ["ownerName", "Property owner"], ["siteAddress", "Site address"], ["parcelId", "Parcel or plot number"], ["contractorName", "Contractor"], ["contractorLicence", "Contractor licence"]] as const).map(([k, l]) => (
                <Field key={k} label={l}><input value={inputs[k] ?? ""} onChange={(e) => setInputs({ ...inputs, [k]: e.target.value })} /></Field>
              ))}
            </div>

            <h2>Documents</h2>
            <ul className="st-docs">
              {pkg.documents.map((d) => {
                const done = (inputs.completedDocs ?? []).includes(d.id);
                return (
                  <li key={d.id} data-status={d.status}>
                    <details>
                      <summary><span>{d.title}</span><em>{{ drafted: "Drafted", provided: "Provided", "needs-input": "Needs your input", professional: "Needs a professional" }[d.status]}</em></summary>
                      {d.content && <pre>{d.content}</pre>}
                      {d.missing.length > 0 && <p className="st-note">Needs: {d.missing.join("; ")}</p>}
                      <p className="st-note">Used for: {d.usedBy.join(", ")}</p>
                      {(d.status === "professional" || d.status === "provided" || (d.status === "needs-input" && !d.content)) && (
                        <label className="st-check"><input type="checkbox" checked={done} onChange={(e) => {
                          const set = new Set<DocId>(inputs.completedDocs ?? []);
                          if (e.target.checked) set.add(d.id); else set.delete(d.id);
                          setInputs({ ...inputs, completedDocs: [...set] });
                        }} />This is already done outside Schema</label>
                      )}
                    </details>
                  </li>
                );
              })}
            </ul>

            <h2>Approvals</h2>
            <label className="st-check"><input type="checkbox" checked={approvals.designApproved} onChange={(e) => setApprovals({ ...approvals, designApproved: e.target.checked })} />I approve the design and any revisions.</label>
            <label className="st-check"><input type="checkbox" checked={approvals.packageApproved} onChange={(e) => setApprovals({ ...approvals, packageApproved: e.target.checked })} />I have reviewed the package contents.</label>

            <h2>Filing</h2>
            <p className="st-note">Schema prepares the package. No supported filing connection exists for these authorities yet, so each permit is a reviewed handoff that a person files.</p>
            <ul className="st-cards">
              {plan.map((p) => (
                <li key={p.permitId} data-ready={p.ready}>
                  <b>{p.name}</b>
                  <span>{p.ready ? "Ready for a person to file." : `Not ready: ${p.blockers.length} item${p.blockers.length === 1 ? "" : "s"} outstanding.`}</span>
                  {!p.ready && <small>{p.blockers.slice(0, 3).join(" ")}{p.blockers.length > 3 ? " …" : ""}</small>}
                  <small>{p.steps.join(" ")}</small>
                </li>
              ))}
            </ul>
            <div className="st-row">
              <button className="st-btn st-primary" onClick={() => download("permit-package.md", renderPackageMarkdown(pkg, new Date().toISOString().slice(0, 10)), "text/markdown")}>Download package (Markdown)</button>
              <button className="st-btn" onClick={() => download("studio-project.json", JSON.stringify({ spec, climate, simulation: sim, codes: { jurisdiction: analysis.jurisdiction.id, codes: analysis.codes, permits: analysis.permits }, package: pkg }, null, 2), "application/json")}>Download project data (JSON)</button>
            </div>
            <p className="st-note">{pkg.disclaimer}</p>
            <NavButtons back={() => setStep(3)} />
          </section>
        )}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="st-field"><span>{label}</span>{children}</label>;
}

function NavButtons({ back, next, nextLabel }: { back?: () => void; next?: () => void; nextLabel?: string }) {
  return (
    <div className="st-nav">
      {back && <button className="st-btn" onClick={back}>Back</button>}
      {next && <button className="st-btn st-primary" onClick={next}>{nextLabel ?? "Next"}</button>}
    </div>
  );
}

function Log({ events }: { events: WorkflowResult["log"] }) {
  if (!events.length) return null;
  return (
    <details className="st-log">
      <summary>Agent activity ({events.length})</summary>
      <ol>{events.map((e) => <li key={e.seq}><b>{e.agent}</b> {e.message}</li>)}</ol>
    </details>
  );
}

function ScenePane({ spec, sim, year, rainOn, setRainOn, caption }: {
  spec: BuildingSpec; sim: SimulationResult; year: number; rainOn: boolean; setRainOn: (v: boolean) => void; caption: string;
}) {
  return (
    <div className="st-stage">
      <Suspense fallback={<div className="st-scene st-loading">Loading 3D view…</div>}>
        <StudioScene spec={spec} sim={sim} year={year} rain={rainOn} label={`3D model of a ${spec.storeys}-storey ${spec.type}. ${caption}`} />
      </Suspense>
      <div className="st-stage-bar">
        <span>{caption}</span>
        <label className="st-check"><input type="checkbox" checked={rainOn} onChange={(e) => setRainOn(e.target.checked)} />Rain</label>
      </div>
    </div>
  );
}

function Chart({ sim, year }: { sim: SimulationResult; year: number }) {
  const W = 320, H = 150, L = 26, B = 18, T = 8, R = 6;
  const x = (i: number) => L + (i / sim.years) * (W - L - R);
  const y = (v: number) => T + (1 - v / 100) * (H - T - B);
  const line = (s: number[]) => s.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const series: [string, number[], string][] = [
    ["Overall", sim.overall, COLORS.overall], ["Structure", sim.elements.structure.condition, COLORS.structure],
    ["Facade", sim.elements.facade.condition, COLORS.facade], ["Roof", sim.elements.roof.condition, COLORS.roof],
  ];
  const summary = series.map(([n, s]) => `${n} ${Math.round(s[sim.years])} out of 100 at year ${sim.years}`).join(", ");
  return (
    <figure className="st-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Condition over time. ${summary}.`}>
        {[100, 70, 50, 30, 0].map((v) => (
          <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={v === 100 || v === 0 ? "ax" : "th"} /><text x={L - 4} y={y(v) + 3} textAnchor="end">{v}</text></g>
        ))}
        {series.map(([n, s, c]) => <path key={n} d={line(s)} fill="none" stroke={c} strokeWidth={n === "Overall" ? 2.6 : 1.6} strokeLinejoin="round" />)}
        <line x1={x(year)} x2={x(year)} y1={T} y2={H - B} className="now" />
        <text x={L} y={H - 4}>0</text><text x={W - R} y={H - 4} textAnchor="end">{sim.years} years</text>
      </svg>
      <figcaption>{series.map(([n, , c]) => <span key={n}><i style={{ background: c }} />{n}</span>)}<span className="st-grade" data-grade={grade(sim.overall[Math.min(sim.years, Math.round(year))])}>Overall now: {Math.round(sim.overall[Math.min(sim.years, Math.round(year))])}/100</span></figcaption>
    </figure>
  );
}

function Compare({ spec, sim, years, maintenance, onPick }: {
  spec: BuildingSpec; sim: SimulationResult; years: number; maintenance: Maintenance; onPick: (el: ElementKey, id: MaterialId) => void;
}) {
  const [el, setEl] = useState<ElementKey>("facade");
  const rows = useMemo(() => compareMaterials(spec, sim.climate, el, { years, maintenance }), [spec, sim.climate, el, years, maintenance]);
  return (
    <div className="st-compare">
      <div className="st-seg" role="group" aria-label="Element to compare">
        {ELEMENTS.map((e) => <button key={e} aria-pressed={e === el} onClick={() => setEl(e)}>{cap(e)}</button>)}
      </div>
      <table>
        <thead><tr><th>Material</th><th>Year {years}</th><th>Cost</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.material} data-current={r.material === spec.materials[el]}>
              <td>{r.label}{r.material === spec.materials[el] ? " (current)" : ""}</td>
              <td data-grade={grade(r.conditionAtHorizon)}>{Math.round(r.conditionAtHorizon)}/100{r.failureYear !== null ? `, fails y${r.failureYear}` : ""}</td>
              <td>{r.costIndex.toFixed(1)}×</td>
              <td>{r.material !== spec.materials[el] && <button className="st-link" onClick={() => onPick(el, r.material)}>Use</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="st-note">Cost is a relative index for ranking only. Dominant stress for the current {el}: {stressLabel(sim.elements[el].dominantStress)}.</p>
    </div>
  );
}

export default StudioApp;
