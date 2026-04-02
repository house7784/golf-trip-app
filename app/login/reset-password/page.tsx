import Link from 'next/link'
import { ArrowLeft, KeyRound } from 'lucide-react'
import { updatePassword } from './actions'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const error = params?.error ? decodeURIComponent(params.error) : ''

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-club-cream text-club-navy">
      <div className="w-full max-w-sm mb-4">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-club-green hover:text-club-navy transition-colors"
        >
          <ArrowLeft size={14} /> Back to Login
        </Link>
      </div>

      <form className="w-full max-w-sm bg-club-paper p-8 rounded-sm shadow-xl border-t-4 border-club-gold space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-3 text-club-gold">
            <KeyRound size={38} strokeWidth={1.75} />
          </div>
          <h1 className="font-serif text-2xl mb-1">Set New Password</h1>
          <p className="font-sans text-xs uppercase tracking-widest text-club-green font-bold">
            Use at least 8 characters
          </p>
        </div>

        {error && (
          <div className="rounded-sm border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-xs font-bold uppercase tracking-wide">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wider font-bold text-club-text/60">
            New Password
          </label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="••••••••"
            className="w-full bg-white border border-club-gold/40 p-3 rounded-sm focus:outline-none focus:border-club-navy transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wider font-bold text-club-text/60">
            Confirm Password
          </label>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            placeholder="••••••••"
            className="w-full bg-white border border-club-gold/40 p-3 rounded-sm focus:outline-none focus:border-club-navy transition-colors"
          />
        </div>

        <button
          formAction={updatePassword as any}
          className="w-full bg-club-navy text-white py-3 px-4 rounded-sm hover:bg-opacity-90 uppercase tracking-wide text-xs font-bold transition-all"
        >
          Update Password
        </button>
      </form>
    </main>
  )
}
