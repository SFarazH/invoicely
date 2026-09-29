import "./globals.css";
import { theme } from "@/lib/theme";

export const metadata = {
  title: "Invoice Templates",
  description: "Design and manage invoice templates",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: theme.font }}>{children}</body>
    </html>
  );
}
