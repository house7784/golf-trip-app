'use client'

import { useState } from 'react'
import { Settings, RotateCcw, X } from 'lucide-react'
import { saveCourseData } from '../scorecard/actions'

export default function CourseSetup({ eventId, roundId, initialData, initialName }: any) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState(initialName || '')
  
  // Default to 18 holes, Par 4
  const [holes, setHoles] = useState(initialData?.holes || Array.from({ length: 18 }).map((_, i) => ({ number: i + 1, par: 4, hcp: i + 1 })))

  const handleSave = async () => {
    await saveCourseData(eventId, roundId, name, holes)
    setIsOpen(false)
  }

  const resetToPar72 = () => {
    const standard = holes.map((h: any) => ({ ...h, par: 4 }))
    setHoles(standard)
  }

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} className="flex items-center gap-1 bg-club-gold/10 text-club-gold px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-club-gold hover:text-club-navy transition-colors">
        <Settings size={12} />
        {initialName ? 'Edit Course' : 'Setup Course'}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col relative">
        
        {/* CLOSE BUTTON */}
        <button 
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 z-50 bg-white rounded-full p-2 hover:bg-gray-100 shadow-sm"
        >
            <X size={24} />
        </button>

        {/* HEADER */}
        <div className="bg-white p-6 border-b border-gray-100">
            <h2 className="font-serif text-3xl text-club-navy mb-1">Course Setup</h2>
            <p className="text-gray-500 text-sm">Enter the scorecard details manually.</p>
        </div>

        {/* THE FORM */}
        <div className="p-6 overflow-y-auto flex-1 bg-white">
            <div className="mb-8">
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Course Name</label>
                <input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. The Quarry at Giants Ridge"
                    className="w-full text-2xl font-serif font-bold border-b-2 border-gray-200 focus:border-black outline-none py-2 text-club-navy"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Front 9 */}
                <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-club-navy border-b-2 border-club-navy pb-2 mb-4">Front 9</h3>
                    <div className="space-y-3">
                        {holes.slice(0, 9).map((hole: any, i: number) => (
                            <HoleRow key={hole.number} hole={hole} index={i} holes={holes} setHoles={setHoles} />
                        ))}
                    </div>
                </div>
                {/* Back 9 */}
                <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-club-navy border-b-2 border-club-navy pb-2 mb-4">Back 9</h3>
                    <div className="space-y-3">
                        {holes.slice(9, 18).map((hole: any, i: number) => (
                            <HoleRow key={hole.number} hole={hole} index={i + 9} holes={holes} setHoles={setHoles} />
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* FOOTER */}
        <div className="p-6 bg-white border-t border-gray-200 flex justify-between items-center">
             <button onClick={resetToPar72} className="text-xs font-bold uppercase text-gray-400 hover:text-black flex items-center gap-2">
                <RotateCcw size={14} /> Reset Defaults
            </button>
            <button onClick={handleSave} className="bg-club-navy text-white py-4 px-12 rounded-lg font-bold uppercase tracking-widest shadow-lg hover:bg-club-gold hover:text-club-navy transition text-lg">
                Save Course
            </button>
        </div>
      </div>
    </div>
  )
}

function HoleRow({ hole, index, holes, setHoles }: any) {
    const updateHole = (field: string, val: string) => {
        const newHoles = [...holes]
        newHoles[index][field] = parseInt(val) || 0
        setHoles(newHoles)
    }
    return (
        <div className="grid grid-cols-10 gap-2 items-center">
            <div className="col-span-2 font-serif font-bold text-xl text-club-navy">{hole.number}</div>
            <div className="col-span-4 relative">
                <span className="absolute top-[-8px] left-0 right-0 text-center text-[8px] font-bold text-gray-300 uppercase">Par</span>
                <input 
                    type="number" 
                    value={hole.par} 
                    onClick={(e) => (e.target as HTMLInputElement).select()} 
                    onChange={(e) => updateHole('par', e.target.value)} 
                    className="w-full h-12 border-2 border-gray-100 rounded-lg text-center font-bold text-xl text-club-navy focus:border-black focus:ring-0 outline-none transition-colors" 
                />
            </div>
            <div className="col-span-4 relative">
                <span className="absolute top-[-8px] left-0 right-0 text-center text-[8px] font-bold text-gray-300 uppercase">HCP</span>
                <input 
                    type="number" 
                    value={hole.hcp} 
                    onClick={(e) => (e.target as HTMLInputElement).select()} 
                    onChange={(e) => updateHole('hcp', e.target.value)} 
                    className="w-full h-12 border-2 border-gray-100 rounded-lg text-center text-gray-500 text-lg focus:border-black focus:ring-0 outline-none transition-colors" 
                />
            </div>
        </div>
    )
}