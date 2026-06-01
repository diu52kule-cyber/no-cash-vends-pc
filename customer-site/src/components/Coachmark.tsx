import { useEffect, useState } from 'react';

/**
 * One-time spotlight that blurs the rest of the screen and points at a target
 * element (the waiter-call bell). Appears on its own, auto-dismisses after a
 * few seconds — no click required. Tapping anywhere dismisses it early.
 */
export function Coachmark({
  targetSelector,
  onDone,
  title,
  body,
}: {
  targetSelector: string;
  onDone: () => void;
  title: string;
  body: string;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(targetSelector) as HTMLElement | null;
      if (el) setRect(el.getBoundingClientRect());
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const t = setTimeout(onDone, 4600);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [targetSelector, onDone]);

  if (!rect) return null;

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const r = Math.max(rect.width, rect.height) / 2 + 8;

  return (
    <div className="coach" onClick={onDone} role="presentation">
      <div
        className="coach-spot"
        style={{ left: cx, top: cy, width: r * 2, height: r * 2 }}
      >
        🛎
      </div>
      <div
        className="coach-tip"
        style={{ top: rect.bottom + 14, right: Math.max(12, window.innerWidth - rect.right) }}
      >
        <strong>{title}</strong>
        {body}
      </div>
    </div>
  );
}
