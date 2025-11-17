import React, { useState, useEffect } from "react";
import "./EmailBanner.css";
import closeCircleIcon from "../assets/close-circle.svg";

const EmailBanner = ({ onSubmit }) => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null); // { type: 'success'|'error', message: string }
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!status) return;

    const timer = setTimeout(() => {
      setStatus(null);
    }, 5000);

    return () => clearTimeout(timer);
  }, [status]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email.trim()) {
      setStatus({ type: "error", message: "Please enter your email." });
      return;
    }

    const cleanedEmail = email.trim();

    const mailchimpUrl =
      "https://x-quo.us11.list-manage.com/subscribe/post";

    const payload = new URLSearchParams({
      EMAIL: cleanedEmail,
      u: "82e2b865d7d8ef53291676964",
      id: "73b0c7601b",
      "b_82e2b865d7d8ef53291676964_73b0c7601b": "",
      f_id: "00b3a3e1f0",
    });

    console.log("[EmailBanner] Submitting email to Mailchimp", {
      email: cleanedEmail,
      endpoint: mailchimpUrl,
    });

    try {
      await fetch(mailchimpUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: payload.toString(),
        mode: "no-cors",
      });

      console.log("[EmailBanner] Mailchimp submission sent");

      setStatus({
        type: "success",
        message: "Thanks! You are now subscribed to our newsletter.",
      });
      setEmail("");
      onSubmit?.(cleanedEmail);
    } catch (error) {
      console.error("[EmailBanner] Failed to submit to Mailchimp:", error);
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

