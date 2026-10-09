// Shown the moment a page is clicked, while its data loads, so a click never
// looks ignored on a slow connection. The menu stays where it is.
export default function Loading() {
  return (
    <div className="skel-page" aria-busy="true">
      <span className="sr-only" role="status">Loading…</span>
      <div className="phead">
        <div className="t">
          <span className="skel" style={{ width: 120, height: 11 }} />
          <span className="skel" style={{ width: 240, height: 26, marginTop: 10 }} />
          <span className="skel" style={{ width: "min(480px, 100%)", height: 13, marginTop: 10 }} />
        </div>
      </div>
      <div className="kpis k4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card skel-card">
            <span className="skel" style={{ width: "50%", height: 11 }} />
            <span className="skel" style={{ width: "35%", height: 24, marginTop: 12 }} />
          </div>
        ))}
      </div>
      <section className="card skel-card">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skel-row">
            <span className="skel" style={{ width: "30%", height: 13 }} />
            <span className="skel" style={{ width: "55%", height: 11, marginTop: 8 }} />
          </div>
        ))}
      </section>
    </div>
  );
}
