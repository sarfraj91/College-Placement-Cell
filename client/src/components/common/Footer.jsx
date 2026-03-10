import { useState } from "react";
import API from "../../services/api";
import "./Footer.css";

const Footer = () => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    rating: 0,
    message: "",
    channel: "web",
  });
  const [status, setStatus] = useState({ error: "", success: "", loading: false });

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  // ✅ Simple rating selector
  const setRating = (value) => setForm((p) => ({ ...p, rating: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ error: "", success: "", loading: true });

    if (!form.rating || !form.message.trim()) {
      setStatus({ error: "Rating and message are required", success: "", loading: false });
      return;
    }

    try {
      const payload = {
        ...form,
        channel: form.phone ? "whatsapp" : "web",
      };

      const res = await API.post("/users/feedback", payload);
      setStatus({ error: "", success: res.data.message, loading: false });
      setForm({
        name: "",
        email: "",
        phone: "",
        rating: 0,
        message: "",
        channel: "web",
      });
    } catch (err) {
      setStatus({
        error: err.response?.data?.message || "Something went wrong",
        success: "",
        loading: false,
      });
    }
  };

  return (
    <footer className="footer">
      <div className="footer-inner">
        {/* ================= BRAND ================= */}
        <div className="footer-brand">
          <h3>Placement Cell</h3>
          <p className="muted">
            Modern placement management for students and admins.
          </p>
          <div className="footer-support">
            <span>Support:</span>
            <a href="tel:+917061609072">7061609072</a>
          </div>
          <a
            className="footer-whatsapp"
            href="https://wa.me/917061609072"
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp Support
          </a>
        </div>

        {/* ================= LINKS ================= */}
        <div className="footer-links">
          <p className="footer-title">Quick Links</p>
          <a href="/login">Login</a>
          <a href="/register">Register</a>
          <a href="/">Home</a>
        </div>

        {/* ================= FEEDBACK ================= */}
        <form className="footer-form" onSubmit={handleSubmit}>
          <p className="footer-title">Support & Feedback</p>

          {status.error && <p className="footer-alert error">{status.error}</p>}
          {status.success && <p className="footer-alert success">{status.success}</p>}

          <input
            name="name"
            placeholder="Your name (optional)"
            value={form.name}
            onChange={handleChange}
          />
          <input
            name="email"
            type="email"
            placeholder="Email (optional)"
            value={form.email}
            onChange={handleChange}
          />
          <input
            name="phone"
            placeholder="WhatsApp number (optional)"
            value={form.phone}
            onChange={handleChange}
          />

          <div className="footer-rating">
            <span>Rating:</span>
            {[1, 2, 3, 4, 5].map((r) => (
              <button
                type="button"
                key={r}
                className={form.rating >= r ? "active" : ""}
                onClick={() => setRating(r)}
              >
                ★
              </button>
            ))}
          </div>

          <textarea
            name="message"
            rows="3"
            placeholder="Your message"
            value={form.message}
            onChange={handleChange}
          />

          <button type="submit" disabled={status.loading}>
            {status.loading ? "Sending..." : "Send Feedback"}
          </button>
        </form>
      </div>

      {/* ================= FOOTER BASE ================= */}
      <div className="footer-base">
        © 2026 Placement Cell System. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
