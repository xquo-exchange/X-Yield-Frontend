import React, { useState } from "react";
import "./EmailBanner.css";
import closeCircleIcon from "../assets/close-circle.svg";

const EmailBanner = ({ onSubmit }) => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null); // { type: 'success'|'error', message: string }
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email.trim()) {
      setStatus({ type: "error", message: "Please enter your email." });
      return;
    }

    const cleanedEmail = email.trim();

    try {
      const response = await fetch("/api/saveEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanedEmail }),
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      setStatus({ type: "success", message: "Thanks! We'll be in touch soon." });
      setEmail("");
      onSubmit?.(cleanedEmail);
    } catch (error) {
      console.error("Failed to save email:", error);
      setStatus({
        type: "error",
        message: "Could not save email. Please try again later.",
      });
    }
  };

  

  if (isCollapsed) {
    return (
      <section
        className="email-banner-collapsed"
        role="button"
        tabIndex={0}
        onClick={() => setIsCollapsed(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsCollapsed(false);
          }
        }}
        aria-label="Expand email updates banner"
      >
        <span className="email-banner-collapsed__label">Stay in the loop</span>
        <span className="email-banner-collapsed__icon">＋</span>
      </section>
    );
  }

  return (
    <section className="email-banner">
      <div className="email-banner__content">
        <button
          className="email-banner__close"
          aria-label="Hide email banner"
          onClick={() => setIsCollapsed(true)}
        >
          −
        </button>
        <div className="email-banner__text">
          <p className="email-banner__eyebrow">Stay in the loop</p>
          <h3>Get early access to vault updates</h3>
          <p>
            Subscribe to receive vault news, yield announcements, and early
            feature previews directly in your inbox.
          </p>
        </div>

        <form className="email-banner__form" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-label="Email address"
          />
          <button type="submit">Notify me</button>
        </form>

        {status && (
          <p
            className={`email-banner__status ${
              status.type === "error" ? "is-error" : "is-success"
            }`}
          >
            {status.message}
          </p>
        )}
      </div>
    </section>
  );
};

export default EmailBanner;

