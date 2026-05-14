'use client'

import { useState } from 'react'
import { Settings, RotateCcw, X } from 'lucide-react'
import { saveCourseData } from '../scorecard/actions'
import { buildDefaultCourseHoles } from '@/lib/handicap'

export default function CourseSetup({ eventId, roundId, initialData, initialName }: any) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState(initialName || '')

    const initialHoles = Array.isArray(initialData?.holes) && initialData.holes.length > 0
        ? initialData.holes
        : buildDefaultCourseHoles(18)
    const [holeCount, setHoleCount] = useState(initialHoles.length <= 9 ? 9 : 18)
    const [holes, setHoles] = useState(initialHoles)

    const applyHoleCount = (nextHoleCount: 9 | 18) => {
        setHoleCount(nextHoleCount)
        setHoles((currentHoles: Array<{ number: number; par: number; hcp: number }>) => {
            if (nextHoleCount === 9) {
                return currentHoles.slice(0, 9)
            }

            const nextHoles = [...currentHoles]
            for (let number = nextHoles.length + 1; number <= 18; number += 1) {
                nextHoles.push({ number, par: 4, hcp: number })
            }
            return nextHoles.slice(0, 18)
        })
    }

  const handleSave = async () => {
    await saveCourseData(eventId, roundId, name, holes)
    setIsOpen(false)
  }

  const resetToPar72 = () => {
        const standard = holes.map((h: any) => ({ ...h, par: 4, hcp: h.number }))
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
    <div className="fixed inset-0 bg-black/90 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto backdrop-blur-md">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col relative mb-8">
        
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

            <div className="mb-8">
                <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Round Length</label>
                <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                    <button
                        type="button"
                        onClick={() => applyHoleCount(9)}
                        className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                            holeCount === 9 ? 'bg-club-navy text-white' : 'text-club-navy/70 hover:bg-white'
                        }`}
                    >
                        9 Holes
                    </button>
                    <button
                        type="button"
                        onClick={() => applyHoleCount(18)}
                        className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                            holeCount === 18 ? 'bg-club-navy text-white' : 'text-club-navy/70 hover:bg-white'
                        }`}
                    >
                        18 Holes
                    </button>
                </div>
                <p className="mt-2 text-[11px] text-gray-400">If handicap scoring is enabled, 9-hole rounds use half handicap before stroke allocation.</p>
            </div>

            <div className={`grid grid-cols-1 ${holeCount === 18 ? 'lg:grid-cols-2' : ''} gap-12`}>
                {/* Front 9 */}
                <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-club-navy border-b-2 border-club-navy pb-2 mb-4">{holeCount === 9 ? 'Holes' : 'Front 9'}</h3>
                    <div className="space-y-3">
                        {holes.slice(0, 9).map((hole: any, i: number) => (
                            <HoleRow key={hole.number} hole={hole} index={i} holes={holes} setHoles={setHoles} />
                        ))}
                    </div>
                </div>
                {/* Back 9 */}
                {holeCount === 18 ? <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-club-navy border-b-2 border-club-navy pb-2 mb-4">Back 9</h3>
                    <div className="space-y-3">
                        {holes.slice(9, 18).map((hole: any, i: number) => (
                            <HoleRow key={hole.number} hole={hole} index={i + 9} holes={holes} setHoles={setHoles} />
                        ))}
                    </div>
                </div> : null}
            </div>
        </div>

        {/* FOOTER */}
        <div className="p-6 bg-white border-t border-gray-200 flex justify-between items-center">
             <button onClick={resetToPar72} className="text-xs font-bold uppercase text-gray-400 hover:text-black flex items-center gap-2">
                <RotateCcw size={14} /> Reset Defaults
            </button>
            <button onClick={handleSave} className="bg-club-navy text-Black py-4 px-12 rounded-lg font-bold uppercase tracking-widest shadow-lg hover:bg-club-gold hover:text-club-navy transition text-lg">
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