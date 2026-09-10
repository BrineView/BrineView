import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ControlTooltipProps {
  tip: string;
  children: React.ReactNode;
}

export default function ControlTooltip({ tip, children }: ControlTooltipProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const show = () => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top });
  };

  const hide = () => setPos(null);

  useEffect(() => {
    // Clear dangling tooltip on unmount
    return () => setPos(null);
  }, []);

  return (
    <div
      ref={wrapRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {pos &&
        createPortal(
          <div
            className="fixed z-[100] px-2.5 py-1.5 rounded text-[10px] leading-tight pointer-events-none"
            style={{
              left: pos.x,
              top: pos.y - 8,
              transform: "translate(-50%, -100%)",
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid #334155",
              color: "var(--text-primary)",
              backdropFilter: "blur(4px)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              maxWidth: 260,
            }}
          >
            {tip}
            {/* Arrow */}
            <div
              className="absolute left-1/2 -translate-x-1/2 top-full"
              style={{
                width: 0,
                height: 0,
                borderLeft: "4px solid transparent",
                borderRight: "4px solid transparent",
                borderTop: "4px solid #334155",
              }}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}