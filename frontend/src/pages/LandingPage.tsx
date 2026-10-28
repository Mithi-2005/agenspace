import { ArrowRight, ArrowDown } from "lucide-react";
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import BrandLogo from "../components/BrandLogo";
import { ThemeControl } from "../components/ThemeControl";
import { brandConfig } from "../config/brand";
import { navigateTo } from "../routing/hashRoute";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

const SpatialScene = lazy(() => import("../components/landing/SpatialScene"));

export const LandingPage: React.FC = () => {
  const reduced = usePrefersReducedMotion();
  const sequenceRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const section = sequenceRef.current;
    if (!section) return;

    const update = () => {
      const rect = section.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      const value = Math.min(1, Math.max(0, -rect.top / travel));
      setProgress(value);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="landing">
      <a className="skip-link" href="#landing-purpose">
        Skip to product details
      </a>
      <header className="landing-nav">
        <BrandLogo />
        <nav aria-label="Public">
          <a href="#landing-purpose">Purpose</a>
          <a href="#landing-preview">Workspace</a>
        </nav>
        <div className="landing-nav-actions">
          <ThemeControl compact />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigateTo("login")}>
            Sign in
          </button>
          <button type="button" className="btn btn-lime btn-sm" onClick={() => navigateTo("register")}>
            Create account
          </button>
        </div>
      </header>

      <section ref={sequenceRef} className="landing-sequence" aria-label="AgenSpace spatial introduction">
        <div className="landing-sticky">
          <div className="landing-hero-copy">
            <h1>
              <span className="hero-brand">{brandConfig.appName}</span>
            </h1>
            <p className="hero-tagline">Work arrives in pieces. Keep it in one place.</p>
            <p className="hero-lead">
              Bring tasks, events, and Gmail follow-ups into one focused workspace. Review suggestions
              before they become commitments.
            </p>
            <div className="hero-actions">
              <button type="button" className="btn btn-lime" onClick={() => navigateTo("register")}>
                Create account
                <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => navigateTo("login")}>
                Sign in
              </button>
            </div>
            <p className="scroll-cue">
              <ArrowDown size={14} aria-hidden="true" />
              {reduced ? "Continue below" : "Scroll to bring the streams together"}
            </p>
          </div>
          <Suspense fallback={<div className="spatial-fallback" />}>
            <SpatialScene progress={reduced ? 1 : progress} />
          </Suspense>
        </div>
      </section>

      <section id="landing-purpose" className="landing-section">
        <div className="landing-section-inner">
          <h2>A workspace for what you must do, what is coming, and what you choose to connect.</h2>
          <div className="purpose-grid">
            <article>
              <h3>Tasks you write</h3>
              <p>
                Create, prioritize, update, and complete tasks in your account. Your list stays yours
                to shape.
              </p>
            </article>
            <article>
              <h3>Events in context</h3>
              <p>
                Add events with dates, times, and locations, and review upcoming commitments alongside
                your tasks.
              </p>
            </article>
            <article>
              <h3>Gmail, in your review</h3>
              <p>
                Sync Gmail to find possible tasks and events. Accept or dismiss each suggestion before
                it enters your workspace.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section id="landing-preview" className="landing-section landing-preview-section">
        <div className="landing-section-inner">
          <h2>A clear view of what needs your attention.</h2>
          <p className="section-lead">
            This preview shows the empty states. Your tasks, events, and Gmail suggestions come from
            your account after sign-in.
          </p>
          <div className="product-frame" aria-label="Workspace sections">
            <div className="product-chrome">
              <span />
              <span />
              <span />
              <em>Dashboard</em>
            </div>
            <div className="product-body">
              <div className="preview-col">
                <header>
                  <strong>Upcoming</strong>
                  <small>Your schedule</small>
                </header>
                <div className="preview-empty">Upcoming events appear here.</div>
              </div>
              <div className="preview-col is-primary">
                <header>
                  <strong>Today</strong>
                  <small>Today</small>
                </header>
                <div className="preview-empty">Your tasks, with due dates and completion state.</div>
              </div>
              <div className="preview-col">
                <header>
                  <strong>Suggested</strong>
                  <small>For review</small>
                </header>
                <div className="preview-empty">Possible tasks and events stay here until you accept or dismiss them.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-cta">
        <div className="landing-section-inner">
          <h2>Enter the workspace.</h2>
          <p>
            Registration and sign-in use the existing {brandConfig.appName} identity service. No
            waitlist, no fabricated onboarding metrics.
          </p>
          <div className="hero-actions">
            <button type="button" className="btn btn-lime" onClick={() => navigateTo("register")}>
              Create account
              <ArrowRight size={16} strokeWidth={1.75} />
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigateTo("login")}>
              Sign in
            </button>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <BrandLogo size={22} />
        <p>{brandConfig.appName} · Tasks, events, and Gmail suggestions in one workspace.</p>
      </footer>
    </div>
  );
};
