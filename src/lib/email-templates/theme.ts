/**
 * Shared email styling for the 11th Pan-IIM WMC.
 * Mirrors the app: forest green on warm paper, General Sans, tight 8px corners,
 * loom motif colours used only as a thin seam.
 */

export const brand = {
  green: "#1d5641",
  greenDark: "#123a2b",
  paper: "#f7f6ef",
  card: "#ffffff",
  ink: "#121f19",
  muted: "#5f6d66",
  line: "#e3e6e0",
  seam: "#c9cec8",
  tint: "#e8f0ec",
};

/** Eight loom colours, one per North East state, used for the top seam. */
export const loom = ["#b8282b", "#d9a33a", "#2f6b4c", "#2a2622", "#2f86c9", "#d9a33a", "#b8282b", "#2f6b4c"];

export const fontStack = "'General Sans', 'Satoshi', 'Helvetica Neue', Helvetica, Arial, sans-serif";
export const displayStack = "'Satoshi', 'General Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
export const fontHref = "https://api.fontshare.com/v2/css?f[]=satoshi@700,900&f[]=general-sans@400,500,600&display=swap";

export const main = {
  backgroundColor: "#ffffff",
  fontFamily: fontStack,
  margin: "0",
  padding: "24px 0",
};

export const container = {
  backgroundColor: brand.card,
  border: `1px solid ${brand.line}`,
  borderRadius: "10px",
  maxWidth: "520px",
  margin: "0 auto",
};

export const eyebrow = {
  fontSize: "12px",
  fontWeight: 600 as const,
  color: brand.green,
  margin: "0 0 10px",
};

export const h1 = {
  fontFamily: displayStack,
  fontSize: "26px",
  lineHeight: "1.15",
  fontWeight: 700 as const,
  letterSpacing: "-0.01em",
  color: brand.ink,
  margin: "0 0 14px",
};

export const text = {
  fontSize: "15px",
  color: brand.muted,
  lineHeight: "1.6",
  margin: "0 0 16px",
};

export const link = { color: brand.green, textDecoration: "underline" };

export const button = {
  backgroundColor: brand.green,
  color: "#ffffff",
  fontFamily: fontStack,
  fontSize: "15px",
  fontWeight: 600 as const,
  border: `1px solid ${brand.greenDark}`,
  borderRadius: "8px",
  padding: "14px 24px",
  textDecoration: "none",
  display: "inline-block",
  boxShadow: "0 2px 0 #123a2b",
};

export const code = {
  fontFamily: displayStack,
  fontSize: "30px",
  letterSpacing: "0.18em",
  fontWeight: 700 as const,
  fontVariantNumeric: "tabular-nums",
  color: brand.ink,
  backgroundColor: brand.paper,
  border: `1px dashed ${brand.seam}`,
  borderRadius: "8px",
  padding: "14px 20px",
  textAlign: "center" as const,
  margin: "0 0 16px",
};

export const footer = {
  fontSize: "12px",
  color: "#8a978f",
  lineHeight: "1.6",
  margin: "18px 0 0",
};

// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
export const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #7fd6b0 !important; color: #0e3d2e !important; border-color: #7fd6b0 !important; }
  }
  [data-ogsc] .dm-btn { background-color: #7fd6b0 !important; color: #0e3d2e !important; }
  [data-ogsb] .dm-btn { background-color: #7fd6b0 !important; color: #0e3d2e !important; }
`;
