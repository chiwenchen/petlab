import { redirect } from "next/navigation";
import { requestOtp } from "@/lib/auth-api";
import { getSessionToken } from "@/lib/session";

export const runtime = "edge";

async function startLogin(formData: FormData): Promise<void> {
  "use server";
  const emailRaw = formData.get("email");
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  if (!email) redirect("/login?error=missing_email");

  const result = await requestOtp(email);
  if (!result.ok) {
    redirect(`/login?error=${encodeURIComponent(result.error ?? "request_failed")}`);
  }
  redirect(`/verify?email=${encodeURIComponent(email)}`);
}

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const token = await getSessionToken();
  if (token) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold text-gray-900">登入 PetLab</h1>
      <p className="mt-2 text-sm text-gray-500">
        輸入 email，我們會寄一組 6 位數驗證碼給你。
      </p>

      <form action={startLogin} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            placeholder="you@example.com"
          />
        </div>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {errorMessage(error)}
          </p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
        >
          寄送驗證碼
        </button>
      </form>
    </main>
  );
}

function errorMessage(code: string): string {
  switch (code) {
    case "missing_email":
      return "請輸入 email";
    case "invalid_email":
      return "Email 格式錯誤";
    case "send_failed":
      return "Email 寄送失敗，稍後再試";
    default:
      return "發生錯誤，請再試一次";
  }
}
