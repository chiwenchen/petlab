import Link from "next/link";
import { Logo } from "./Logo";

interface Props {
  email?: string;
}

/** Top app bar shown on all authenticated pages. Brand left, logout right. */
export function AppNav({ email }: Props) {
  return (
    <nav className="flex items-center justify-between border-b border-gray-200 pb-4">
      <Link href="/dashboard" aria-label="PetLab dashboard">
        <Logo size={24} />
      </Link>
      <div className="flex items-center gap-4 text-xs text-gray-400">
        {email ? <span className="hidden sm:inline">{email}</span> : null}
        <form action="/logout" method="post">
          <button
            type="submit"
            className="text-xs text-gray-400 hover:text-gray-700"
          >
            登出
          </button>
        </form>
      </div>
    </nav>
  );
}
