import Link from 'next/link'
import { AlertCircle, CheckCircle, ChevronLeft } from 'lucide-react'
import { PasswordInput } from '@/components/ui/PasswordInput'

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { error, success } = await props.searchParams

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0A0F1E]">
      {/* Background glows */}
      <div className="absolute inset-0 bg-grid z-0 opacity-30" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--accent)] rounded-full mix-blend-screen filter blur-[128px] opacity-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#4F46E5] rounded-full mix-blend-screen filter blur-[128px] opacity-10" />

      <div className="relative z-10 w-full max-w-[420px] px-6">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-[var(--text-secondary)] hover:text-white transition-colors mb-8 group"
        >
          <ChevronLeft className="w-4 h-4 mr-1 transition-transform group-hover:-translate-x-1" />
          Back to Home
        </Link>

        <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center gap-2 mb-4 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] animate-pulse" />
              <span className="text-sm font-semibold tracking-wide text-white">StockVision Pro</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Welcome back</h1>
            <p className="text-sm text-[var(--text-secondary)]">Sign in to your account</p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="p-3 mb-6 text-sm text-[var(--negative)] bg-[rgba(255,90,90,0.1)] border border-[rgba(255,90,90,0.2)] rounded-xl flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              {decodeURIComponent(error)}
            </div>
          )}
          {success && (
            <div className="p-3 mb-6 text-sm text-[var(--positive)] bg-[rgba(0,229,160,0.08)] border border-[rgba(0,229,160,0.2)] rounded-xl flex items-center gap-2">
              <CheckCircle size={16} className="shrink-0" />
              {decodeURIComponent(success)}
            </div>
          )}

          {/* Form posts to route handler so Set-Cookie is flushed correctly */}
          <form method="POST" action="/api/auth/login" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider pl-1">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-xl px-4 py-3 bg-black/20 border border-white/5 text-white placeholder:text-white/20 focus:outline-none focus:border-[var(--accent)] focus:bg-white/5 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between pl-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-[var(--accent)] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <PasswordInput name="password" placeholder="••••••••" autoComplete="current-password" />
            </div>

            <button
              type="submit"
              className="w-full mt-2 bg-[var(--accent)] text-[#0A0F1E] font-bold rounded-xl px-4 py-3.5 hover:bg-[#00c98d] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,229,160,0.3)]"
            >
              Sign In
            </button>
          </form>

          <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-[var(--accent)] hover:underline font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
