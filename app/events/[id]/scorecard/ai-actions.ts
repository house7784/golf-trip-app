'use server'

import OpenAI from 'openai'

export async function findCourseDetails(courseName: string) {
  if (!courseName) return null

  // 1. Initialize OpenAI
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY in .env.local")

  const openai = new OpenAI({ apiKey })

  console.log(`Using OpenAI to find: ${courseName}...`)

  // 2. The Prompt
  const prompt = `
    I need the scorecard data for the golf course: "${courseName}".
    Please provide the Par and Handicap (HCP) for all 18 holes.
    
    Rules:
    1. Search your knowledge base for the official scorecard of this course.
    2. Return ONLY a raw JSON array. Do not wrap it in markdown (no \`\`\`json).
    3. If specific HCP data is unavailable, use a sensible default (alternating odd/even) but get the Pars correct.
    
    Expected JSON Format:
    [
      { "number": 1, "par": 4, "hcp": 10 },
      { "number": 2, "par": 5, "hcp": 2 },
      ... (for all 18 holes)
    ]
  `

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4o", // Or "gpt-3.5-turbo" if you want it cheaper/faster
      temperature: 0.1, // Low temperature = more factual
    })

    const text = completion.choices[0].message.content || ""
    
    // Clean string just in case GPT adds markdown
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim()
    
    console.log("OpenAI Success!")
    return JSON.parse(cleanJson)

  } catch (error) {
    console.error("OpenAI Error:", error)
    return null
  }
}