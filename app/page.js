import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";

export default function HomePage() {
  const token = cookies().get(COOKIE_NAME)?.value;
  const payload = verifyToken(token);
  redirect(payload ? "/templates" : "/login");
}
