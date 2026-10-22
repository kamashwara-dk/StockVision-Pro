import Link from 'next/link'
import { forgotPassword } from '@/app/login/actions'
import { AlertCircle, CheckCircle, ChevronLeft, Mail } from 'lucide-react'

export default async function ForgotPasswordPage(props: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { error, success } = await props.searchParams

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0A0F1E]">
      {/* Background glows */}
      <div className="absolute inset-0 bg-grid z-0 opacity-30" />
      <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-[var(--accent)] rounded-full mix-blend-screen filter blur-[128px] opacity-10" />
      <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-[#4F46E5] rounded-full mix-blend-screen filter blur-[128px] opacity-10" />

      <div className="relative z-10 w-full max-w-[420px] px-6">
        <Link
          href="/login"
          className="inline-flex items-center text-sm font-medium text-[var(--text-secondary)] hover:text-white transition-colors mb-8 group"
        >
          <ChevronLeft className="w-4 h-4 mr-1 transition-transform group-hover:-translate-x-1" />
          Back to Sign In
        </Link>

        <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl">
          {/* Icon + heading */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[rgba(0,229,160,0.1)] border border-[rgba(0,229,160,0.2)] flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-[var(--accent)]" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Forgot password?</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="p-3 mb-6 text-sm text-[var(--negative)] bg-[rgba(255,90,90,0.1)] border border-[rgba(255,90,90,0.2)] rounded-xl flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="p-4 mb-6 text-sm text-[var(--positive)] bg-[rgba(0,229,160,0.08)] border border-[rgba(0,229,160,0.2)] rounded-xl flex items-start gap-2">
              <CheckCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Email sent!</p>
                <p>{success}</p>
              </div>
            </div>
          )}

          {!success && (
            <form className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider pl-1">
                  Email Address
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

              <button
                formAction={forgotPassword}
                className="w-full mt-1 bg-[var(--accent)] text-[#0A0F1E] font-bold rounded-xl px-4 py-3.5 hover:bg-[#00c98d] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,229,160,0.3)]"
              >
                Send Reset Link
              </button>
            </form>
          )}

          {success && (
            <Link
              href="/login"
              className="block w-full text-center bg-white/5 border border-white/10 text-white font-bold rounded-xl px-4 py-3.5 hover:bg-white/10 transition-all"
            >
              Back to Sign In
            </Link>
          )}

          {!success && (
            <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
              Remember your password?{' '}
              <Link href="/login" className="text-[var(--accent)] hover:underline font-medium">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
