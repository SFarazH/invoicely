import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import InvoiceBuilder from "@/components/InvoiceBuilder";
import LogoutButton from "@/components/LogoutButton";

export default function TemplatesPage() {
  const token = cookies().get(COOKIE_NAME)?.value;
  const payload = verifyToken(token);

  if (!payload) {
    redirect("/login");
  }

  return (
    <div style={{ height: "100vh" }}>
      <InvoiceBuilder headerActions={<LogoutButton mail="y" />} />
    </div>
  );
}
