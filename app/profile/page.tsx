import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, UserRound } from 'lucide-react'
import { updatePassword, updateProfileDetails } from './actions'

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>
}) {
  const supabase = await createClient()
  const query = await searchParams
  const status = query?.status

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, handicap_index')
    .eq('id', user.id)
    .single()

  return (
    <main className="min-h-screen bg-club-cream text-club-navy p-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-white p-2 rounded-sm border border-club-navy/10 shadow-sm">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="font-serif text-2xl text-club-navy">My Profile</h1>
            <p className="text-xs text-club-text/60">Manage your name, handicap index, and password</p>
          </div>
        </div>

        {status === 'profile_saved' && (
          <div className="bg-white border border-green-200 p-3 rounded-sm text-sm text-green-700">
            Profile saved.
          </div>
        )}

        {status === 'profile_error' && (
          <div className="bg-white border border-red-200 p-3 rounded-sm text-sm text-red-700">
            Could not save profile. Please try again.
          </div>
        )}

        {status === 'password_saved' && (
          <div className="bg-white border border-green-200 p-3 rounded-sm text-sm text-green-700">
            Password updated.
          </div>
        )}

        {status === 'password_mismatch' && (
          <div className="bg-white border border-red-200 p-3 rounded-sm text-sm text-red-700">
            Passwords do not match.
          </div>
        )}

        {status === 'password_too_short' && (
          <div className="bg-white border border-red-200 p-3 rounded-sm text-sm text-red-700">
            Password must be at least 8 characters.
          </div>
        )}

        {status === 'password_error' && (
          <div className="bg-white border border-red-200 p-3 rounded-sm text-sm text-red-700">
            Could not update password. Please try again.
          </div>
        )}

        <div className="bg-club-paper p-6 rounded-sm shadow-sm border-t-4 border-club-gold space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-club-navy/10 p-3 rounded-full">
              <UserRound className="text-club-navy h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-club-text/60 font-bold">Member</p>
              <h2 className="font-serif text-xl text-club-navy">{profile?.full_name || 'Member'}</h2>
            </div>
          </div>

          <form action={updateProfileDetails} className="space-y-3">
            <label className="block text-xs uppercase tracking-wider font-bold text-club-text/60">
              Full Name
            </label>
            <input
              name="fullName"
              type="text"
              defaultValue={profile?.full_name ?? ''}
              className="w-full bg-white border border-club-gold/40 p-3 rounded-sm font-serif text-lg"
            />

            <label className="block text-xs uppercase tracking-wider font-bold text-club-text/60">
              Handicap Index
            </label>
            <input
              name="handicapIndex"
              type="number"
              step="0.1"
              min="0"
              required
              defaultValue={profile?.handicap_index ?? 0}
              className="w-full bg-white border border-club-gold/40 p-3 rounded-sm font-serif text-lg"
            />
            <button className="w-full bg-club-navy text-white py-3 rounded-sm hover:bg-opacity-90 uppercase tracking-wide text-xs font-bold transition-all">
              Save Profile
            </button>
          </form>

          <p className="text-xs text-club-text/60">Changes apply to future events and unlocked events. Event handicaps lock one week before start.</p>
        </div>

        <div className="bg-club-paper p-6 rounded-sm shadow-sm border-t-4 border-club-navy space-y-4">
          <h3 className="font-serif text-lg text-club-navy">Change Password</h3>
          <form action={updatePassword} className="space-y-3">
            <label className="block text-xs uppercase tracking-wider font-bold text-club-text/60">New Password</label>
            <input
              name="newPassword"
              type="password"
              minLength={8}
              required
              className="w-full bg-white border border-club-navy/30 p-3 rounded-sm"
            />
            <label className="block text-xs uppercase tracking-wider font-bold text-club-text/60">Confirm Password</label>
            <input
              name="confirmPassword"
              type="password"
              minLength={8}
              required
              className="w-full bg-white border border-club-navy/30 p-3 rounded-sm"
            />
            <button className="w-full bg-club-gold text-club-navy py-3 rounded-sm hover:bg-club-navy hover:text-white uppercase tracking-wide text-xs font-bold transition-all">
              Update Password
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
