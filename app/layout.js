import "./globals.css";
import { theme } from "@/lib/theme";
import { AuthProvider } from "@/components/AuthContext";

export const metadata = {
  title: "Invoice Templates",
  description: "Design and manage invoice templates",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: theme.font }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
