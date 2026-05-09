import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  Camera,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import API from "../../services/api";
import AuthShowcase from "./AuthShowcase";
import ParticleMesh from "../ui/ParticleMesh";
import placementLogo from "../../assets/placement-logo.png";
import "./Auth.css";

const showcaseHighlights = [
  {
    icon: Sparkles,
    title: "Profile-first onboarding",
    description: "Create a polished student account before you start applying.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Ready for opportunities",
    description: "Keep your details prepared so applications and shortlists move faster.",
  },
  {
    icon: ShieldCheck,
    title: "Official email verification",
    description: "Student signups are verified before access is fully activated.",
  },
];

const Register = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullname: "",
    email: "",
    password: "",
  });

  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setAvatar(file);
    setPreview(URL.createObjectURL(file));
  };

  // ✅ Simple frontend validation for college email domain
  const isCollegeEmail = (value) =>
    value.toLowerCase().trim().endsWith("@mitmeerut.ac.in");

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    // ✅ Frontend validation
    if (!isCollegeEmail(form.email)) {
      setError("Email must end with @mitmeerut.ac.in");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("fullname", form.fullname);
      formData.append("email", form.email);
      formData.append("password", form.password);
      if (avatar) formData.append("avatar", avatar);

      await API.post("/users/register", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // ✅ Go to OTP verification screen
      navigate("/verify-email", { state: { email: form.email } });
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-stage">
        <ParticleMesh className="auth-stage__mesh" />
        <div className="auth-stage__halo" aria-hidden="true" />

        <div className="auth-card-shell">
          <section className="auth-card">
            <div className="auth-card__top">
              <div className="auth-card__brand">
                <img src={placementLogo} alt="Placement Cell logo" />
                <span>Student Onboarding</span>
              </div>

              <div className="auth-panel__switch" aria-label="Auth pages">
                <Link to="/login">Login</Link>
                <span className="is-active">Register</span>
              </div>
            </div>

            <div className="auth-panel__header">
              <span className="auth-panel__eyebrow">Student Registration</span>
              <h1>Create account</h1>
              <p>
                Register with your institute email and complete a cleaner,
                lighter student signup flow.
              </p>
            </div>

            {error && (
              <div className="auth-alert" role="alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="auth-inline-note">
              <ShieldCheck size={16} />
              <span>
                Student registration uses <strong>@mitmeerut.ac.in</strong> for
                email verification. Admin signup remains separate.
              </span>
            </div>

            <form className="auth-form" onSubmit={handleRegister}>
              <label className="auth-avatar-picker" htmlFor="avatar-input">
                <div className="auth-avatar-picker__preview">
                  {preview ? (
                    <img src={preview} alt="Avatar preview" />
                  ) : (
                    <Camera size={22} />
                  )}
                </div>

                <div className="auth-avatar-picker__content">
                  <strong>Upload profile picture</strong>
                  <p>Add a photo for your student profile.</p>
                  <span className="auth-avatar-picker__button">
                    <Camera size={14} />
                    Choose image
                  </span>
                </div>
              </label>

              <input
                id="avatar-input"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                hidden
              />

              <div className="auth-form__row">
                <label className="auth-field">
                  <span className="auth-field__label">Full name</span>
                  <div className="auth-field__input">
                    <UserRound size={16} />
                    <input
                      name="fullname"
                      placeholder="Full name"
                      value={form.fullname}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </label>

                <label className="auth-field">
                  <span className="auth-field__label">College email</span>
                  <div className="auth-field__input">
                    <Mail size={16} />
                    <input
                      name="email"
                      type="email"
                      placeholder="yourname@mitmeerut.ac.in"
                      value={form.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </label>
              </div>

              <label className="auth-field">
                <span className="auth-field__label">Password</span>
                <div className="auth-field__input">
                  <LockKeyhole size={16} />
                  <input
                    name="password"
                    type="password"
                    placeholder="Create password"
                    value={form.password}
                    onChange={handleChange}
                    required
                  />
                </div>
                <span className="auth-field__hint">
                  Use at least 8 characters for a stronger password.
                </span>
              </label>

              <button className="auth-submit" type="submit">
                <span>Create account</span>
                <ArrowRight size={16} />
              </button>
            </form>

            <div className="auth-panel__footer">
              <p>
                Already registered? <Link to="/login">Login instead</Link>
              </p>
              <Link className="auth-panel__footer-link" to="/">
                Back to home
              </Link>
            </div>
          </section>
        </div>

        <AuthShowcase
          title="Create your student placement profile."
          description="A smaller signup card with softer colors and a subtle 3D animated background behind the form."
          highlights={showcaseHighlights}
        />
      </div>
    </div>
  );
};

export default Register;
