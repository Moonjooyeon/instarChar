import React from "react";

const SCREEN_STYLE: React.CSSProperties = { alignItems: "center", background: "#15131a", color: "#f2eef5", display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, sans-serif", justifyContent: "center", minHeight: "100dvh", padding: "24px", textAlign: "center" };
const BRAND_STYLE: React.CSSProperties = { fontSize: "13px", fontWeight: 900, letterSpacing: "0.18em" };
const STATUS_STYLE: React.CSSProperties = { color: "#b7a7d2", fontSize: "14px", margin: "14px 0 0" };

export function AppLaunchScreen(): React.ReactElement {
  return <main style={SCREEN_STYLE} aria-busy="true" aria-live="polite"><strong style={BRAND_STYLE}>ALIVE</strong><p style={STATUS_STYLE}>서비스를 준비하고 있어요.</p></main>;
}
