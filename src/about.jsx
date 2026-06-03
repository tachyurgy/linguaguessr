export default function About({ onHome }) {
  return (
    <div className="about fadein">
      <span className="kicker">A demo by Levelbrook</span>
      <h1 className="lead">
        Senior <span className="g">software engineering consultants</span> for teams that need a real
        engineer on the team this week.
      </h1>
      <p className="big" style={{ fontSize: 18 }}>
        Levelbrook is a principal-led consulting practice — not a body shop with a bench it can't fill.
        The engineer who answers your email is the one doing the work. We aren't boxed into one stack:
        Ruby on Rails is our strongest and most-requested, with Python, Node and AWS right alongside.
        LinguaGuessr is a weekend-sized demo of that range end to end — data pipeline, React front end,
        global edge deploy.
      </p>

      <div className="cards3">
        <div className="svc card">
          <div className="ic">🔧</div>
          <h3>Senior, drop-in</h3>
          <p>Staff augmentation that actually augments. Experienced engineers who ship from week one, backed by a small network of vetted senior people.</p>
        </div>
        <div className="svc card">
          <div className="ic">⚡</div>
          <h3>Performance &amp; scale</h3>
          <p>Query optimization, Postgres and background-job pipelines, AWS cost and infrastructure. We make slow, expensive systems fast and cheap.</p>
        </div>
        <div className="svc card">
          <div className="ic">🔌</div>
          <h3>APIs &amp; integration</h3>
          <p>Third-party integrations, OAuth/SSO, the connective tissue between systems — built cleanly so it keeps working after we hand it off.</p>
        </div>
      </div>

      <h2 className="display" style={{ fontSize: 26, marginTop: 28 }}>What we do</h2>
      <div className="pills">
        <span className="pill">Ruby on Rails</span>
        <span className="pill">Python &amp; FastAPI</span>
        <span className="pill">Node &amp; TypeScript</span>
        <span className="pill">Staff augmentation</span>
        <span className="pill">API &amp; integration builds</span>
        <span className="pill">Performance &amp; scaling</span>
        <span className="pill">PostgreSQL</span>
        <span className="pill">AWS infrastructure</span>
        <span className="pill">AI / LLM tooling</span>
      </div>

      <p className="muted">
        Backend-focused, full-stack when it counts, conversant across stacks, US-based, and direct. No
        account managers between you and the code. Rails is where we go deepest — but the job is shipping
        the right thing, not defending a framework. If your team needs a senior engineer who can land in
        an existing codebase and start shipping, that's the whole job.
      </p>

      <div className="cta">
        <h2 className="display">Need a senior engineer this week?</h2>
        <p className="muted">Tell us what you're building or what's on fire. You'll talk to the person who'd be doing the work.</p>
        <div className="btnrow">
          <a className="btn" href="https://levelbrook.com" target="_blank" rel="noreferrer" style={{ width: "auto" }}>
            Hire us →
          </a>
          <button className="btn ghost" style={{ width: "auto" }} onClick={onHome}>▶ Play LinguaGuessr</button>
        </div>
      </div>

      <p className="faint" style={{ fontSize: 13 }}>
        Audio: native-speaker recordings from <a href="https://lingualibre.org" target="_blank" rel="noreferrer">Lingua Libre</a> /
        Wikimedia Commons, used under their Creative Commons licenses. LinguaGuessr is an independent demo and isn't affiliated with those projects.
      </p>
    </div>
  );
}
