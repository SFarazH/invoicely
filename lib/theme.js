// Shared design tokens for the app shell (auth pages, templates library).
// Kept intentionally small — this isn't a full design-system package, just
// the handful of values reused across a few files so they stay consistent.

export const theme = {
  font: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`,
  color: {
    bg: "#FBFBFD",
    surface: "#FFFFFF",
    text: "#1D1D1F",
    textSecondary: "#6E6E73",
    textTertiary: "#86868B",
    border: "#E8E8ED",
    borderStrong: "#D2D2D7",
    accent: "#4F46E5",
    accentHover: "#4338CA",
    accentSoft: "#F0EFFE",
    danger: "#E5484D",
  },
  radius: { sm: 8, md: 12, lg: 16, xl: 20 },
  shadow: {
    sm: "0 1px 2px rgba(0,0,0,0.04)",
    md: "0 4px 20px rgba(0,0,0,0.06)",
    lg: "0 16px 48px rgba(0,0,0,0.12)",
  },
  ease: "cubic-bezier(0.16, 1, 0.3, 1)",
  transition: "all 180ms cubic-bezier(0.4, 0, 0.2, 1)",
};

export const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  fontSize: 15,
  fontFamily: theme.font,
  color: theme.color.text,
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.sm,
  outline: "none",
  boxSizing: "border-box",
  transition: theme.transition,
};

export const primaryButtonStyle = {
  width: "100%",
  padding: "12px 0",
  fontSize: 15,
  fontWeight: 600,
  fontFamily: theme.font,
  color: "#fff",
  background: theme.color.accent,
  border: "none",
  borderRadius: theme.radius.sm,
  cursor: "pointer",
  transition: theme.transition,
  letterSpacing: -0.1,
};
