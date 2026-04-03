'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, KeyRound } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resendEmail, setResendEmail] = useState('')
  const [resendStatus, setResendStatus] = useState('')
  const [isResending, setIsResending] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let cancelled = false

    const prepareRecovery = async () => {
      const code = searchParams.get('code')
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          if (!cancelled) {
            setError('Invalid or expired reset link. Please request a new one.')
          }
          return
        }

        // Remove query params after successful exchange.
        window.history.replaceState(null, '', '/login/reset-password')
      }

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const hashAccessToken = hashParams.get('access_token')
      const hashRefreshToken = hashParams.get('refresh_token')

      if (hashAccessToken && hashRefreshToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: hashAccessToken,
          refresh_token: hashRefreshToken,
        })

        if (setSessionError) {
          if (!cancelled) {
            setError('Invalid or expired reset link. Please request a new one.')
          }
          return
        }

        // Clean up URL hash after session is established.
        window.history.replaceState(null, '', '/login/reset-password')
      }

      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')

      if (tokenHash && type === 'recovery') {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: tokenHash,
        })

        if (verifyError) {
          if (!cancelled) {
            setError('Invalid or expired reset link. Please request a new one.')
          }
          return
        }
      }

      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        if (!cancelled) {
          setError('Reset link is invalid or expired. Request a new reset email.')
        }
        return
      }

      if (!cancelled) {
        setReady(true)
      }
    }

    prepareRecovery()

    return () => {
      cancelled = true
    }
  }, [searchParams, supabase])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setIsSubmitting(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess('Password updated. Redirecting to login...')
    setTimeout(() => {
      router.push('/login?success=Password%20updated.%20Please%20sign%20in.')
    }, 900)
  }

  const handleResend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setResendStatus('')

    const email = resendEmail.trim()
    if (!email) {
      setResendStatus('Enter your email first.')
      return
    }

    setIsResending(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login/reset-password`,
    })
    setIsResending(false)

    if (resetError) {
      setResendStatus(`Could not send reset email: ${resetError.message}`)
      return
    }

    setResendStatus('New reset link sent. Check your email.')
  }

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

      <div className="w-full max-w-sm bg-club-paper p-8 rounded-sm shadow-xl border-t-4 border-club-gold space-y-6">
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

        {!ready ? (
          <div className="rounded-sm border border-club-gold/30 bg-white px-3 py-3 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-club-navy/80">
              Need a fresh reset link?
            </p>
            <form onSubmit={handleResend} className="space-y-2">
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="member@club.com"
                className="w-full bg-white border border-club-gold/40 p-2.5 rounded-sm text-sm focus:outline-none focus:border-club-navy transition-colors"
                disabled={isResending}
                required
              />
              <button
                type="submit"
                disabled={isResending}
                className="w-full bg-club-navy text-white py-2.5 px-3 rounded-sm text-[11px] font-bold uppercase tracking-wide disabled:opacity-50"
              >
                {isResending ? 'Sending...' : 'Send New Reset Link'}
              </button>
            </form>
            {resendStatus && (
              <p className="text-[11px] font-semibold text-club-navy/80">{resendStatus}</p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {success && (
              <div className="rounded-sm border border-green-200 bg-green-50 text-green-700 px-3 py-2 text-xs font-bold uppercase tracking-wide">
                {success}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-club-gold/40 p-3 rounded-sm focus:outline-none focus:border-club-navy transition-colors"
                disabled={isSubmitting}
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
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-club-gold/40 p-3 rounded-sm focus:outline-none focus:border-club-navy transition-colors"
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-club-navy text-white py-3 px-4 rounded-sm hover:bg-opacity-90 uppercase tracking-wide text-xs font-bold transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-club-cream text-club-navy">
          <div className="w-full max-w-sm bg-club-paper p-8 rounded-sm shadow-xl border-t-4 border-club-gold">
            <p className="text-sm font-bold uppercase tracking-wide text-club-navy/70 text-center">Loading reset page...</p>
          </div>
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
