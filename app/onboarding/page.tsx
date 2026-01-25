'use client'

import { completeProfile } from './actions'

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-club-navy flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-club-gold p-6 text-center">
          <h1 className="font-serif text-3xl text-club-navy mb-1">Welcome to the Club</h1>
          <p className="text-club-navy/80 text-sm font-bold uppercase tracking-wider">Player Setup</p>
        </div>

        {/* Form */}
        <form action={completeProfile} className="p-8 space-y-8">
          
          <div className="text-center space-y-2">
            <p className="text-gray-600 font-medium">To calculate net scores, we just need one thing:</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-2 text-center">
              What is your current Handicap?
            </label>
            <input 
              name="handicap"
              type="number" 
              step="0.1"
              placeholder="0.0"
              required
              className="w-full text-center text-5xl font-serif font-bold border-b-2 border-gray-200 py-4 focus:border-club-gold outline-none text-club-navy placeholder:text-gray-200"
              autoFocus
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-club-navy text-white py-4 rounded-lg font-bold uppercase tracking-widest hover:bg-club-gold hover:text-club-navy transition-all shadow-lg"
          >
            Start Playing
          </button>
        </form>
      </div>
    </div>
  )
}