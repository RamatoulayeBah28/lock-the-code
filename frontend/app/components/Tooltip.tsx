"use client";

import { useTips } from "./TipsProvider";

type Props = {
  content: string;
  children: React.ReactNode;
  className?: string;
  position?: "top" | "bottom" | "right";
};

export default function Tooltip({ content, children, className = "inline-flex", position = "top" }: Props) {
  const tipsEnabled = useTips();
  if (!tipsEnabled) return <div className={className}>{children}</div>;
  const posStyle: React.CSSProperties =
    position === "top"
      ? { bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" }
      : position === "bottom"
      ? { top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" }
      : { left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" };

  const arrowStyle: React.CSSProperties =
    position === "top"
      ? { top: "100%", left: "50%", transform: "translateX(-50%)", borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid var(--foreground)" }
      : position === "bottom"
      ? { bottom: "100%", left: "50%", transform: "translateX(-50%)", borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: "5px solid var(--foreground)" }
      : { right: "100%", top: "50%", transform: "translateY(-50%)", borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderRight: "5px solid var(--foreground)" };

  return (
    <div className={`relative group ${className}`}>
      {children}
      <div
        className="absolute z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        style={posStyle}
      >
        <div
          className="text-xs font-medium px-2.5 py-1.5 rounded-lg text-center"
          style={{
            backgroundColor: "var(--foreground)",
            color: "var(--surface)",
            maxWidth: "180px",
            whiteSpace: "normal",
            lineHeight: 1.4,
          }}
        >
          {content}
        </div>
        <div className="absolute w-0 h-0" style={arrowStyle} />
      </div>
    </div>
  );
}
