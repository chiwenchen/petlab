import { redirect } from "next/navigation";
import { fetchMe } from "./auth-api";
import { getSessionToken, clearSessionCookie } from "./session";

interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
  created_at: number;
}

export async function requireUser(): Promise<{ token: string; user: AuthUser }> {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const user = await fetchMe(token);
  if (!user) {
    await clearSessionCookie();
    redirect("/login?error=expired");
  }

  return { token, user };
}
