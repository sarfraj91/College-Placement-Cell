import {
  motion as Motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  Briefcase,
  FileText,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import { Link } from "react-router-dom";
import ParticleMesh from "../components/ui/ParticleMesh";
import "./Home.css";

const featureCards = [
  {
    icon: ShieldCheck,
    label: "Invite Control",
    title: "Only the right students see the right opportunities",
    text: "Keep campus drives cleaner with invite-based visibility, shortlists, and controlled access.",
    meta: "Controlled job access",
    tone: "deep",
  },
  {
    icon: FileText,
    label: "Resume AI",
    title: "Students understand role fit before they apply",
    text: "Highlight missing skills, improve resume quality, and make profile updates with more confidence.",
    meta: "Skill-gap insights",
    tone: "soft",
  },
  {
    icon: Video,
    label: "Mock Interview",
    title: "Practice feels easier when feedback is built in",
    text: "Prepare for interviews with guided sessions that feel focused, calm, and easier to repeat.",
    meta: "Guided interview prep",
    tone: "neutral",
  },
  {
    icon: Briefcase,
    label: "Placement Tracking",
    title: "Admins stay on top of progress without messy dashboards",
    text: "Monitor applications, invitations, and placement movement from one organized workflow.",
    meta: "One clear admin view",
    tone: "accent",
  },
];

const proofItems = [
  "Invite-only access",
  "Resume skill-gap insights",
  "Mock interview practice",
];

const backgroundOrbs = [
  {
    id: 1,
    left: "8%",
    top: "10%",
    size: "220px",
    color: "rgba(96, 150, 186, 0.18)",
  },
  {
    id: 2,
    left: "80%",
    top: "16%",
    size: "180px",
    color: "rgba(39, 76, 119, 0.12)",
  },
  {
    id: 3,
    left: "14%",
    top: "70%",
    size: "170px",
    color: "rgba(96, 150, 186, 0.14)",
  },
  {
    id: 4,
    left: "82%",
    top: "74%",
    size: "140px",
    color: "rgba(39, 76, 119, 0.1)",
  },
];

const showcaseTags = ["Resume Match", "Interview Prep", "Invite Jobs"];

const Home = () => {
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();

  const progressScale = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const backgroundY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const meshY = useTransform(scrollYProgress, [0, 1], [0, 70]);
  const heroY = useTransform(scrollYProgress, [0, 0.35], [0, -34]);
  const featureY = useTransform(scrollYProgress, [0.12, 0.88], [0, -26]);

  const revealUp = (delay = 0) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 28 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.18 },
          transition: { duration: 0.58, ease: "easeOut", delay },
        };

  return (
    <div className="landing-page relative overflow-x-hidden">
      <Motion.div
        className="landing-scrollbar fixed inset-x-0 top-0 z-[60] h-[3px] origin-left"
        style={prefersReducedMotion ? undefined : { scaleX: progressScale }}
      />

      <div className="landing-background fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <Motion.div
          className="landing-background-mesh absolute inset-0"
          style={prefersReducedMotion ? undefined : { y: meshY }}
        >
          <ParticleMesh className="landing-page-mesh" />
        </Motion.div>

        <Motion.div
          className="landing-background-plane absolute inset-0"
          style={prefersReducedMotion ? undefined : { y: backgroundY }}
        />

        {backgroundOrbs.map(({ id, left, top, size, color }) => (
          <Motion.div
            key={id}
            className="landing-orb absolute rounded-full"
            style={{
              left,
              top,
              width: size,
              height: size,
              background: color,
            }}
            animate={
              prefersReducedMotion
                ? undefined
                : {
                    y: [0, -18, 0],
                    scale: [1, 1.06, 1],
                  }
            }
            transition={
              prefersReducedMotion
                ? undefined
                : {
                    duration: 8 + id,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
            }
          />
        ))}
      </div>

      <div className="landing-side-glow landing-side-glow-left" aria-hidden="true" />
      <div className="landing-side-glow landing-side-glow-right" aria-hidden="true" />

      <section className="relative z-10 pt-8 pb-8 md:pt-10 md:pb-10">
        <div className="mx-auto w-[min(1240px,calc(100%-32px))] md:w-[min(1240px,calc(100%-48px))]">
          <Motion.div
            className="landing-hero-shell grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.94fr)]"
            style={prefersReducedMotion ? undefined : { y: heroY }}
          >
            <Motion.div className="relative z-10" {...revealUp()}>
              <h1 className="landing-hero-title">
                A cleaner platform for placements,
                <span> resumes, and interview prep</span>
              </h1>

              <p className="landing-hero-copy mt-5">
                PlacementCell gives students and admins one focused workflow for
                job access, resume improvement, interview practice, and
                placement tracking.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/register"
                  className="landing-button landing-button-primary inline-flex items-center justify-center gap-2"
                >
                  Create Account
                  <ArrowRight size={17} />
                </Link>

                <Link
                  to="/login"
                  className="landing-button landing-button-secondary inline-flex items-center justify-center"
                >
                  Open Workspace
                </Link>
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                {proofItems.map((item) => (
                  <div key={item} className="landing-proof-pill">
                    <Sparkles size={14} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </Motion.div>

            <Motion.div className="landing-showcase" {...revealUp(0.1)}>
              <div className="landing-showcase-orb" aria-hidden="true">
                <ParticleMesh className="landing-showcase-orb-mesh" />
              </div>

              <div className="landing-showcase-card">
                <span className="landing-showcase-card-kicker">PlacementCell Flow</span>
                <h2>One calmer workspace for every important student action</h2>
                <p>
                  Invite-based jobs, resume analysis, and interview practice
                  stay organized instead of feeling scattered.
                </p>

                <div className="landing-showcase-mini-grid">
                  {showcaseTags.map((item) => (
                    <span key={item} className="landing-showcase-tag">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="landing-showcase-chip landing-showcase-chip-top">
                <span className="landing-showcase-chip-label">Resume Analyzer</span>
                <strong>Skill gaps and role fit</strong>
              </div>

              <div className="landing-showcase-chip landing-showcase-chip-bottom">
                <span className="landing-showcase-chip-label">Mock Interview</span>
                <strong>Practice with guided feedback</strong>
              </div>
            </Motion.div>
          </Motion.div>
        </div>
      </section>

      <section className="relative z-10 pt-2 pb-16 md:pt-4 md:pb-20">
        <div className="mx-auto w-[min(1240px,calc(100%-32px))] md:w-[min(1240px,calc(100%-48px))]">
          <Motion.div className="landing-feature-intro" {...revealUp()}>
            <span className="landing-section-kicker">Core Features</span>
            <h2>Everything important, arranged in one cleaner system</h2>
            <p>
              The cards are simpler, easier to scan, and designed to feel
              premium without overwhelming the page.
            </p>
          </Motion.div>

          <div className="landing-feature-stage">
            <div className="landing-feature-stage-mesh" aria-hidden="true">
              <ParticleMesh className="landing-grid-mesh" />
            </div>

            <Motion.div
              className="landing-feature-grid"
              style={prefersReducedMotion ? undefined : { y: featureY }}
            >
              {featureCards.map((item, index) => {
                const Icon = item.icon;

                return (
                  <Motion.article
                    key={item.title}
                    className={`landing-feature-card landing-feature-card-${index + 1}`}
                    data-tone={item.tone}
                    {...revealUp(index * 0.06)}
                    whileHover={
                      prefersReducedMotion
                        ? undefined
                        : {
                            y: -10,
                            rotateX: 4,
                            rotateY: index % 2 === 0 ? 4 : -4,
                            transition: {
                              type: "spring",
                              stiffness: 280,
                              damping: 20,
                            },
                          }
                    }
                  >
                    <span className="landing-feature-shadow" aria-hidden="true" />

                    <div className="landing-feature-top">
                      <div className="landing-feature-icon">
                        <Icon size={20} />
                      </div>
                      <span className="landing-feature-label">{item.label}</span>
                    </div>

                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                    <span className="landing-feature-meta">{item.meta}</span>
                  </Motion.article>
                );
              })}
            </Motion.div>
          </div>
        </div>
      </section>

      <section className="relative z-10 pb-16 md:pb-20">
        <div className="mx-auto w-[min(1120px,calc(100%-32px))] md:w-[min(1120px,calc(100%-48px))]">
          <Motion.div className="landing-cta-card" {...revealUp()}>
            <span className="landing-section-kicker">Get Started</span>
            <h2>Give students a placement platform that feels focused and premium</h2>
            <p>
              Bring applications, resume improvement, and interview practice
              into one user-friendly flow.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                to="/register"
                className="landing-button landing-button-primary inline-flex items-center justify-center gap-2"
              >
                Start Now
                <ArrowRight size={17} />
              </Link>

              <Link
                to="/login"
                className="landing-button landing-button-secondary inline-flex items-center justify-center"
              >
                Sign In
              </Link>
            </div>
          </Motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;
