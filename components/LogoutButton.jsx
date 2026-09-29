  "use client";

  import { useRouter } from "next/navigation";
  import { theme } from "@/lib/theme";

  export default function LogoutButton() {
    const router = useRouter();

    async function handleLogout() {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    }

    return (
      <button
        onClick={handleLogout}
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: theme.color.textSecondary,
          background: "transparent",
          border: "none",
          borderRadius: theme.radius.sm,
          padding: "7px 12px",
          cursor: "pointer",
          transition: theme.transition,
          fontFamily: theme.font,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#F2F2F4";
          e.currentTarget.style.color = theme.color.text;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = theme.color.textSecondary;
        }}
      >
        Log out
      </button>
    );
  }
