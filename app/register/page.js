import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { theme } from "@/lib/theme";
import RegisterForm from "@/components/RegisterForm";

export default function RegisterPage() {
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
            Create an account
          </h1>
          <p style={{ fontSize: 15, color: theme.color.textSecondary, margin: 0 }}>
            Design and manage your invoice templates.
          </p>
        </div>

        <RegisterForm />

        <p style={{ marginTop: 24, fontSize: 14, color: theme.color.textSecondary, textAlign: "center" }}>
          Already have an account?{" "}
          <a href="/login" style={{ color: theme.color.accent, fontWeight: 500, textDecoration: "none" }}>
            Log in
          </a>
        </p>
      </div>
    </main>
  );
}
