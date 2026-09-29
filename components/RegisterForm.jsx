"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { theme, inputStyle, primaryButtonStyle } from "@/lib/theme";
import { useAuth } from "@/components/AuthContext";

export default function RegisterForm() {
  const router = useRouter();
  const { setActiveUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }
      setActiveUser(data);
      router.push("/templates");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle = (name) => ({
    ...inputStyle,
    borderColor: focused === name ? theme.color.accent : theme.color.border,
    boxShadow:
      focused === name ? `0 0 0 3px ${theme.color.accentSoft}` : "none",
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ marginBottom: 16 }}>
        <label
          htmlFor="name"
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 500,
            color: theme.color.textSecondary,
            marginBottom: 6,
          }}
        >
          Name
        </label>
        <input
          id="name"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setFocused("name")}
          onBlur={() => setFocused(null)}
          style={fieldStyle("name")}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label
          htmlFor="email"
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 500,
            color: theme.color.textSecondary,
            marginBottom: 6,
          }}
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => setFocused("email")}
          onBlur={() => setFocused(null)}
          style={fieldStyle("email")}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label
          htmlFor="password"
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 500,
            color: theme.color.textSecondary,
            marginBottom: 6,
          }}
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={() => setFocused("password")}
          onBlur={() => setFocused(null)}
          style={fieldStyle("password")}
        />
        <div
          style={{
            fontSize: 12,
            color: theme.color.textTertiary,
            marginTop: 6,
          }}
        >
          At least 6 characters.
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="animate-fade-up"
          style={{
            fontSize: 13.5,
            color: theme.color.danger,
            background: "#FDF0F0",
            border: "1px solid #F6D6D6",
            borderRadius: theme.radius.sm,
            padding: "9px 12px",
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          ...primaryButtonStyle,
          opacity: loading ? 0.75 : 1,
          cursor: loading ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
        onMouseEnter={(e) => {
          if (!loading)
            e.currentTarget.style.background = theme.color.accentHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = theme.color.accent;
        }}
        onMouseDown={(e) => {
          if (!loading) e.currentTarget.style.transform = "scale(0.98)";
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {loading && (
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.4)",
              borderTopColor: "#fff",
              animation: "spin 700ms linear infinite",
            }}
          />
        )}
        {loading ? "Creating account" : "Create account"}
      </button>
    </form>
  );
}
