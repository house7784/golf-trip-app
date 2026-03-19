// app/signup/page.tsx
import { Trophy } from 'lucide-react'
import Link from 'next/link'
import { registerMember } from './actions'

export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-club-cream text-club-navy">

      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex justify-center mb-4 text-club-gold">
          <Trophy size={48} strokeWidth={1.5} />
        </div>
        <h1 className="font-serif text-3xl mb-2">New Member</h1>
        <p className="font-sans text-xs uppercase tracking-widest text-club-green font-bold">
          The Invitational 2026
        </p>
      </div>

      <form
        action={registerMember}
        className="w-full max-w-sm bg-club-paper p-8 rounded-sm shadow-xl border-t-4 border-club-gold space-y-5"
      >

        {/* Full Name */}
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wider font-bold text-club-text/60">
            Full Name
          </label>
          <input
            name="fullName"
            type="text"
            required
            placeholder="Jake House"
            className="w-full bg-white border border-club-gold/40 p-3 rounded-sm focus:outline-none focus:border-club-navy transition-colors"
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wider font-bold text-club-text/60">
            Email Address
          </label>
          <input
            name="email"
            type="email"
            required
            placeholder="member@club.com"
            className="w-full bg-white border border-club-gold/40 p-3 rounded-sm focus:outline-none focus:border-club-navy transition-colors"
          />
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wider font-bold text-club-text/60">
            Password
          </label>
          <input
            name="password"
            type="password"
            required
            placeholder="••••••••"
            minLength={6}
            className="w-full bg-white border border-club-gold/40 p-3 rounded-sm focus:outline-none focus:border-club-navy transition-colors"
          />
        </div>

        {/* Handicap */}
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wider font-bold text-club-text/60">
            Estimated Handicap Index
          </label>
          <input
            name="handicap"
            type="number"
            step="0.1"
            min="0"
            max="54"
            required
            placeholder="e.g. 14.2"
            className="w-full bg-white border border-club-gold/40 p-3 rounded-sm focus:outline-none focus:border-club-navy transition-colors text-center text-2xl font-serif font-bold"
          />
          <p className="text-[11px] text-club-text/40 text-center">
            Enter 0 if you don't have an official handicap
          </p>
        </div>

        {/* Submit */}
        <div className="pt-2 space-y-3">
          <button
            type="submit"
            className="w-full bg-club-gold text-club-navy py-3 px-4 rounded-sm hover:bg-opacity-90 uppercase tracking-wide text-xs font-bold transition-all shadow-md"
          >
            Join the Club
          </button>

          <p className="text-center text-xs text-club-text/50">
            Already a member?{' '}
            <Link href="/login" className="text-club-navy font-bold underline">
              Sign In
            </Link>
          </p>
        </div>

      </form>
    </main>
  )
}
