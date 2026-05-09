import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Clock3,
  MessageCircleMore,
  PhoneCall,
} from "lucide-react";
import { Link } from "react-router-dom";
import logo from "../../assets/placement-logo.png";
import "./Footer.css";

const helpfulLinks = [
  { label: "Home", to: "/" },
  { label: "Available Jobs", to: "/job" },
  { label: "Resume Analyzer", to: "/student/resume-analyzer" },
  { label: "Mock Interview", to: "/preparation/mock-interview" },
];

const Footer = () => {
  const year = new Date().getFullYear();
  const supportPhone =
    import.meta.env.VITE_SUPPORT_PHONE || "+91 70616 09072";
  const supportWhatsAppUrl =
    import.meta.env.VITE_SUPPORT_WHATSAPP_URL ||
    "https://wa.me/917061609072";
  const supportHours =
    import.meta.env.VITE_SUPPORT_HOURS || "10am - 6pm";
  const socialLinks = [
    {
      href:
        import.meta.env.VITE_SOCIAL_FACEBOOK_URL ||
        "https://facebook.com/your-page",
      label: "Facebook",
    },
    {
      href:
        import.meta.env.VITE_SOCIAL_TWITTER_URL ||
        "https://twitter.com/your-handle",
      label: "Twitter",
    },
    {
      href:
        import.meta.env.VITE_SOCIAL_YOUTUBE_URL ||
        "https://youtube.com/@your-channel",
      label: "YouTube",
    },
    {
      href:
        import.meta.env.VITE_SOCIAL_INSTAGRAM_URL ||
        "https://instagram.com/your-handle",
      label: "Instagram",
    },
    {
      href:
        import.meta.env.VITE_SOCIAL_LINKEDIN_URL ||
        "https://linkedin.com/company/your-page",
      label: "LinkedIn",
    },
  ];
  const supportPhoneHref = `tel:${supportPhone.replace(/\s+/g, "")}`;

  return (
    <footer className="footer-shell">
      <div className="footer-container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="footer-brand-link">
              <img
                src={logo}
                alt="PlacementCell logo"
                className="footer-logo"
              />

              <div>
                <span className="footer-kicker">Interview Prep</span>
                <h2>PlacementCell</h2>
              </div>
            </Link>

            <p className="footer-copy">
              AI-powered placement support for student profiles, invited job
              applications, resume analysis, and mock interview preparation.
            </p>

            <a
              className="footer-whatsapp"
              href={supportWhatsAppUrl}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircleMore size={18} />
              WhatsApp Support
            </a>
          </div>

          <div className="footer-column">
            <h3>Helpful Links</h3>
            <div className="footer-link-list">
              {helpfulLinks.map((item) => (
                <Link key={item.to} to={item.to} className="footer-link">
                  <ArrowRight size={16} />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="footer-column">
            <h3>Get In Touch</h3>
            <div className="footer-contact-list">
              <a href={supportPhoneHref} className="footer-contact">
                <PhoneCall size={18} />
                {supportPhone}
              </a>

              <a
                href={supportWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="footer-contact"
              >
                <MessageCircleMore size={18} />
                Chat on WhatsApp
              </a>

              <div className="footer-contact">
                <BriefcaseBusiness size={18} />
                Invite-only job support
              </div>

              <div className="footer-contact">
                <Clock3 size={18} />
                Support hours: {supportHours}
              </div>
            </div>
          </div>

          <div className="footer-column">
            <h3>Connect With Us</h3>
            <div className="footer-social-list">
              {socialLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="footer-social"
                >
                  <ArrowUpRight size={18} />
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="footer-bottom">Copyright © {year} PlacementCell</div>
      </div>
    </footer>
  );
};

export default Footer;
