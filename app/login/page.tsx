// app/login/page.tsx
import { login, signup } from '@/app/login/actions'
import { Trophy } from 'lucide-react'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-club-cream text-club-navy">
      
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex justify-center mb-4 text-club-gold">
          <Trophy size={48} strokeWidth={1.5} />
        </div>
        <h1 className="font-serif text-3xl mb-2">Member Access</h1>
        <p className="font-sans text-xs uppercase tracking-widest text-club-green font-bold">
          The Invitational 2026
        </p>
      </div>

      {/* Login Form */}
      <form className="w-full max-w-sm bg-club-paper p-8 rounded-sm shadow-xl border-t-4 border-club-gold space-y-6">
        
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

        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wider font-bold text-club-text/60">
            Password
          </label>
          <input 
            name="password" 
            type="password" 
            required 
            placeholder="••••••••"
            className="w-full bg-white border border-club-gold/40 p-3 rounded-sm focus:outline-none focus:border-club-navy transition-colors"
          />
        </div>

        <div className="space-y-2">
           <label className="block text-xs uppercase tracking-wider font-bold text-club-text/60">
            Full Name (New Members Only)
          </label>
          <input 
            name="fullName" 
            type="text" 
            placeholder="Jake House"
            className="w-full bg-white border border-club-gold/40 p-3 rounded-sm focus:outline-none focus:border-club-navy transition-colors"
          />
        </div>

        <div className="pt-4 space-y-3">
          {/* We use 'as any' here to satisfy the strict TypeScript checks */}
          <button 
            formAction={login as any} 
            className="w-full bg-club-navy text-white py-3 px-4 rounded-sm hover:bg-opacity-90 uppercase tracking-wide text-xs font-bold transition-all"
          >
            Sign In
          </button>
          
          <button 
            formAction={signup as any} 
            className="w-full bg-transparent border border-club-navy text-club-navy py-3 px-4 rounded-sm hover:bg-club-navy hover:text-white uppercase tracking-wide text-xs font-bold transition-all"
          >
            New Member Registration
          </button>
        </div>

      </form>
    </main>
  )
}