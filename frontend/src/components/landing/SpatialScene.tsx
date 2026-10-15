import React, { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

interface SpatialSceneProps {
  progress: number;
}

export const SpatialScene: React.FC<SpatialSceneProps> = ({ progress }) => {
  const reduced = usePrefersReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || reduced) return;

    let frame = 0;
    const onMove = (event: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      pointer.current = {
        x: ((event.clientX - rect.left) / rect.width - 0.5) * 2,
        y: ((event.clientY - rect.top) / rect.height - 0.5) * 2,
      };
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const { x, y } = pointer.current;
        stage.style.setProperty("--px", x.toFixed(3));
        stage.style.setProperty("--py", y.toFixed(3));
      });
    };

    stage.addEventListener("pointermove", onMove);
    return () => {
      stage.removeEventListener("pointermove", onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [reduced]);

  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <div
      ref={stageRef}
      className={`spatial-stage ${reduced ? "is-static" : ""}`}
      style={{ "--scene": String(clamped) } as React.CSSProperties}
      aria-hidden="true"
    >
      <div className="spatial-world">
        <div className="spatial-atmosphere" />
        <div className="spatial-ground" />
        <div className="spatial-horizon" />

        <article className="spatial-plane plane-mail">
          <span className="plane-kicker">01 / Mail</span>
          <strong>Unread streams</strong>
          <em>Separate</em>
        </article>
        <article className="spatial-plane plane-calendar">
          <span className="plane-kicker">02 / Calendar</span>
          <strong>Commitments</strong>
          <em>Independent</em>
        </article>
        <article className="spatial-plane plane-tasks">
          <span className="plane-kicker">03 / Tasks</span>
          <strong>Work you own</strong>
          <em>Manual</em>
        </article>

        <div className="spatial-chamber">
          <div className="chamber-frame">
            <span className="chamber-label">Kosway chamber</span>
            <div className="chamber-grid">
              <b />
              <b />
              <b />
              <b />
            </div>
            <p>One environment</p>
          </div>
          <div className="chamber-lintel" />
          <div className="chamber-plinth" />
        </div>

        <div className="spatial-ticks">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
};

export default SpatialScene;
