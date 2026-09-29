"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { theme } from "@/lib/theme";
import { Blobatar } from "blobatar/react";
import { useAuth } from "@/components/AuthContext";
import "blobatar/motion.css";

export default function LogoutButton() {
  const router = useRouter();
  const { activeUser, setActiveUser } = useAuth();

  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    setActiveUser(null);
    router.push("/login");
    router.refresh();
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "inline-flex",
      }}
    >
      {/* Avatar */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Account menu"
        aria-expanded={open}
        style={{
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {activeUser && (
          <Blobatar
            // name="blobatar"
            name={activeUser?.email || "blobatar"}
            animate="always"
            size={50}
          />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 150,
            padding: 6,
            background: "#fff",
            border: "1px solid #e8e8ec",
            borderRadius: 12,
            boxShadow:
              "0 12px 40px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.04)",
            zIndex: 99999,
          }}
        >
          <div
            style={{
              padding: "10px 10px 12px",
              borderBottom: "1px solid #f0f0f2",
              marginBottom: 4,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: theme.color.text,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={activeUser?.name || ""}
            >
              {activeUser?.name || ""}
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "9px 10px",
              border: "none",
              borderRadius: 8,
              background: "transparent",
              color: theme.color.textSecondary,
              fontSize: 13,
              fontWeight: 500,
              fontFamily: theme.font,
              textAlign: "left",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f2f2f4";
              e.currentTarget.style.color = theme.color.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = theme.color.textSecondary;
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
              <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
            </svg>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
