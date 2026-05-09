import placementLogo from "../../assets/placement-logo.png";

const placementStats = [
  { value: "2.4k+", label: "Student Profiles" },
  { value: "36", label: "Live Drives" },
  { value: "89%", label: "Profile Completion" },
];

const AuthShowcase = ({ title, description, highlights }) => {
  return (
    <aside className="auth-showcase">
      <div className="auth-showcase__badge">
        <img
          className="auth-showcase__logo"
          src={placementLogo}
          alt="Placement Cell logo"
        />
        <div className="auth-showcase__badge-copy">
          <strong>Placement Cell</strong>
          <span>Secure student access</span>
        </div>
      </div>

      <div className="auth-showcase__stats">
        {placementStats.map((stat) => (
          <div key={stat.label} className="auth-showcase__stat-card">
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="auth-showcase__tile auth-showcase__tile--secondary">
        <span className="auth-showcase__eyebrow">Why It Works</span>
        <div className="auth-showcase__highlights">
          {highlights.map(({ icon: Icon, title: itemTitle, description: itemText }) => (
            <div key={itemTitle} className="auth-showcase__highlight">
              <div className="auth-showcase__highlight-icon">
                <Icon size={16} strokeWidth={2.1} />
              </div>
              <div>
                <h3>{itemTitle}</h3>
                <p>{itemText}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default AuthShowcase;
