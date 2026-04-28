import { redirect } from "next/navigation";
import { verifyOtp } from "@/lib/auth-api";
import { setSessionCookie, getSessionToken } from "@/lib/session";

export const runtime = "edge";

const JWT_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days, matches backend

async function submitCode(formData: FormData): Promise<void> {
  "use server";
  const emailRaw = formData.get("email");
  const codeRaw = formData.get("code");
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  const code = typeof codeRaw === "string" ? codeRaw.trim() : "";

  if (!email || !code) {
    redirect(`/verify?email=${encodeURIComponent(email)}&error=missing`);
  }

  const result = await verifyOtp(email, code);
  if (!result.ok || !result.data) {
    redirect(`/verify?email=${encodeURIComponent(email)}&error=${encodeURIComponent(result.error ?? "verify_failed")}`);
  }

  await setSessionCookie(result.data.token, JWT_TTL_SECONDS);
  redirect("/dashboard");
}

interface Props {
  searchParams: Promise<{ email?: string; error?: string }>;
}

export default async function VerifyPage({ searchParams }: Props) {
  const existing = await getSessionToken();
  if (existing) redirect("/dashboard");

  const { email, error } = await searchParams;
  if (!email) redirect("/login");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-bold">輸入驗證碼</h1>
      <p className="mt-2 text-sm text-gray-500">
        驗證碼已寄到 <span className="font-medium">{email}</span>。
      </p>

      <form action={submitCode} className="mt-6 space-y-4">
        <input type="hidden" name="email" value={email} />
        <div>
          <label htmlFor="code" className="block text-sm font-medium">
            6 位數驗證碼
          </label>
          <input
            id="code"
            name="code"
            required
            autoFocus
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-center text-2xl tracking-widest shadow-sm focus:border-gray-900 focus:outline-none"
            placeholder="000000"
          />
        </div>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {errorMessage(error)}
          </p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
        >
          登入
        </button>

        <p className="text-center text-xs text-gray-500">
          沒收到？<a href="/login" className="underline">重新寄送</a>
        </p>
      </form>
    </main>
  );
}

function errorMessage(code: string): string {
  switch (code) {
    case "missing":
      return "請輸入驗證碼";
    case "wrong_code":
      return "驗證碼錯誤";
    case "expired":
      return "驗證碼已過期，請重新寄送";
    case "no_otp":
      return "找不到驗證碼，請重新寄送";
    case "too_many_attempts":
      return "嘗試次數過多，請稍後再試";
    default:
      return "驗證失敗，請再試一次";
  }
}
