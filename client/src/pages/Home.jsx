import { Link } from "react-router-dom";
import "./Home.css";

const Home = () => {
  return (
    <section className="hero page-shell">
      <div className="page-inner hero-grid">
        {/* ================= COPY ================= */}
        <div className="hero-copy fade-in">
          <span className="badge">Placement Cell OS</span>
          <h1>
            Smart Placement <span>Management System</span>
          </h1>
          <p className="muted">
            A unified workspace for students and admins to manage profiles,
            screening, and placement workflows with clarity and speed.
          </p>

          <div className="hero-actions">
            <Link to="/register" className="btn-primary">
              Get Started
            </Link>
            <Link to="/login" className="btn-ghost">
              Sign In
            </Link>
          </div>

          <div className="hero-metrics">
            <div className="metric-card">
              <p>Unified Profiles</p>
              <h3>One Hub</h3>
            </div>
            <div className="metric-card">
              <p>Smart Filtering</p>
              <h3>Instant</h3>
            </div>
            <div className="metric-card">
              <p>Placement Readiness</p>
              <h3>Always On</h3>
            </div>
          </div>
        </div>

        {/* ================= VISUAL ================= */}
        <div className="hero-visual">
          <div className="orb large float" />
          <div className="orb small float" />

          <div className="glass-card hero-card">
            <p className="muted">Placement Pipeline</p>
            <h3>Filter • Email • Select</h3>
            <div className="hero-bars">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="glass-card hero-card secondary">
            <p className="muted">Profile Health</p>
            <h3>Ready for Review</h3>
            <div className="hero-progress">
              <div className="bar" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Home;
