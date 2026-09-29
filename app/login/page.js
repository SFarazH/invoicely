import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { theme } from "@/lib/theme";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (verifyToken(token)) {
    redirect("/templates");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: theme.color.bg,
      }}
    >
      <div className="animate-fade-up" style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: theme.radius.md,
              background: theme.color.text,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <span style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>I</span>
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: -0.4,
              margin: "0 0 6px",
              color: theme.color.text,
            }}
          >
            Welcome back
          </h1>
          <p style={{ fontSize: 15, color: theme.color.textSecondary, margin: 0 }}>
            Log in to continue to your templates.
          </p>
        </div>

        <LoginForm />

        <p style={{ marginTop: 24, fontSize: 14, color: theme.color.textSecondary, textAlign: "center" }}>
          No account?{" "}
          <a href="/register" style={{ color: theme.color.accent, fontWeight: 500, textDecoration: "none" }}>
            Register
          </a>
        </p>
      </div>
    </main>
  );
}
