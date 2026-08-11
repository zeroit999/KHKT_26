export function OverviewStat({ icon, tone, value, title, subtitle }) {
  return (
    <article className="overview-stat">
      <span className={`overview-stat-icon ${tone}`}>{icon}</span>
      <strong>{value}</strong>
      <h4>{title}</h4>
      <p>{subtitle}</p>
    </article>
  );
}

export function ProgressRow({ label, value, detail }) {
  return (
    <div className="progress-row">
      <div><span>{label}</span><small>{detail}</small></div>
      <div className="progress-track"><i style={{ width: `${value}%` }} /></div>
    </div>
  );
}

export function DataUnavailable({ icon, text }) {
  return (
    <div className="data-unavailable"><span>{icon}</span><p>{text}</p></div>
  );
}

export function StatCard({ label, value, tone }) {
  return (
    <article className="stat-card">
      <p>{label}</p>
      <strong className={tone}>{value}</strong>
    </article>
  );
}
