const DUTY_DESK_URL = process.env.NEXT_PUBLIC_DUTY_DESK_URL || "#";
const GATEHOUSE_URL = process.env.NEXT_PUBLIC_GATEHOUSE_URL || "#";

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

function RadioIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14" />
    </svg>
  );
}

export default function PortalPage() {
  return (
    <div className="portal-shell">
      <div>
        <h1 className="portal-title">The Destination — Operations Portal</h1>
        <p className="portal-sub">One link for both departments. Pick your platform below to sign in with your username and usercode.</p>
      </div>

      <div className="portal-tiles">
        <a href={DUTY_DESK_URL} className="portal-tile portal-tile-dd">
          <div className="portal-tile-icon"><HomeIcon /></div>
          <div className="portal-tile-name">Duty Desk</div>
          <div className="portal-tile-desc">Resident Officer department — checklists, complaints, maintenance, duty log.</div>
        </a>
        <a href={GATEHOUSE_URL} className="portal-tile portal-tile-gh">
          <div className="portal-tile-icon"><RadioIcon /></div>
          <div className="portal-tile-name">Gatehouse</div>
          <div className="portal-tile-desc">Security department — incidents, access control, patrols, alerts.</div>
        </a>
      </div>

      <div className="portal-foot">This page holds no accounts and no data — it only links to each platform&apos;s own login.</div>
    </div>
  );
}
