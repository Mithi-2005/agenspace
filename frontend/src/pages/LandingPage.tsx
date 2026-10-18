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
          <a href="#landing-moon">Moon</a>
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
            <p className="eyebrow">Personal productivity environment</p>
            <h1>
              <span className="hero-brand">{brandConfig.appName}</span>
              <span className="hero-line">Work arrives in pieces.</span>
              <span className="hero-line accent">It should live in one place.</span>
            </h1>
            <p className="hero-lead">
              Mail, calendars, and handwritten todos rarely share a desk. {brandConfig.appName} is being
              built as the chamber where those streams meet — without pretending they already do.
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
          <p className="eyebrow">Positioning</p>
          <h2>A workspace for what you must do, what is coming, and what you choose to connect.</h2>
          <div className="purpose-grid">
            <article>
              <span>01</span>
              <h3>Tasks you write</h3>
              <p>
                Create and complete todos yourself. Persistence to the server is a later phase; the
                workspace already treats tasks as first-class work, not decoration.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>Events you can trust</h3>
              <p>
                Upcoming commitments will appear only from sources you authorize, with a clear origin —
                never as guessed dates dressed up as a calendar.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>Connections you review</h3>
              <p>
                Gmail and calendars will connect through official authorization. Suggested actions stay
                suggestions until you accept them.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section id="landing-preview" className="landing-section landing-preview-section">
        <div className="landing-section-inner">
          <p className="eyebrow">Product</p>
          <h2>The workspace, not a marketing facsimile.</h2>
          <p className="section-lead">
            Compact navigation. Tasks, events, and reviewable suggestions as the primary surfaces.
            Moon remains named, not performed.
          </p>
          <div className="product-frame" aria-hidden="true">
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
                  <small>No calendar connected</small>
                </header>
                <div className="preview-empty">Events appear after a calendar or mail source is authorized.</div>
              </div>
              <div className="preview-col is-primary">
                <header>
                  <strong>Today</strong>
                  <small>Your list</small>
                </header>
                <ul>
                  <li>
                    <b /> Draft the weekly note
                    <i>Today</i>
                  </li>
                  <li>
                    <b /> Confirm venue hold
                    <i>Due 16:00</i>
                  </li>
                </ul>
              </div>
              <div className="preview-col">
                <header>
                  <strong>Suggested</strong>
                  <small>For review</small>
                </header>
                <div className="preview-empty">Detected items stay here until you accept or dismiss them.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-inner split">
          <div>
            <p className="eyebrow">Tasks & events</p>
            <h2>Manual work now. Connected work when the APIs exist.</h2>
            <p>
              You can already keep a session task list: title, notes, due time, priority, completion.
              Events and extracted suggestions have typed front-end boundaries and honest empty states —
              they do not invent meetings from thin air.
            </p>
          </div>
          <div>
            <p className="eyebrow">Connections</p>
            <h2>Gmail and calendars, when authorization is real.</h2>
            <p>
              The Connections area names Gmail, Google Calendar, and Outlook Calendar as intended
              sources. Each is marked unavailable until a backend integration can complete a genuine
              OAuth flow.
            </p>
          </div>
        </div>
      </section>

      <section id="landing-moon" className="landing-section moon-section">
        <div className="landing-section-inner">
          <p className="eyebrow">Assistance</p>
          <h2>
            {brandConfig.assistantName} is the in-app assistant — named, scoped, and not yet in the
            room.
          </h2>
          <p className="section-lead">
            When it ships, {brandConfig.assistantName} is intended to help inspect suggestions, draft
            follow-ups, and keep the workspace moving. It does not answer questions in this release, and
            no chat surface is shown as if it did.
          </p>
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
        <p>
          {brandConfig.appName} · Identity & session security in production · Tasks, events, and
          connections are being assembled in the open.
        </p>
      </footer>
    </div>
  );
};
