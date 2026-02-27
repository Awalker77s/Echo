import { env } from './env'

export interface GeneratedIdea {
  content: string
  category: 'business' | 'creative' | 'goal' | 'action' | 'other'
  idea_type: string
  details: string
}

interface ParsedIdeas {
  ideas: GeneratedIdea[]
}

const systemPrompt = `You are an AI idea extraction helper. Analyze this journal entry and extract actionable ideas. For each idea found, return it with:
- content: a clear, concise description of the idea (one sentence)
- category: one of "business", "creative", "goal", "action", "other"
- idea_type: one of "business_idea", "problem_solution", "concept", "action_step"
- details: an expanded explanation (2-3 sentences) that develops the idea further

Look for:
- Business ideas mentioned or implied
- Creative directions and artistic concepts
- Goals and aspirations worth pursuing
- Actionable next steps
- Solutions to problems described

Return JSON with an ideas array containing 4-8 ideas. If no clear ideas are found, still surface actionable suggestions based on what the user is thinking about.`

export async function generateIdeasForEntry(entryText: string): Promise<GeneratedIdea[]> {
  const apiKey = env.openAiKey
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured. Set VITE_OPENAI_API_KEY in your .env file.')
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.4,
      instructions: systemPrompt,
      input: [{ role: 'user', content: entryText }],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI API failed (${response.status}): ${text}`)
  }

  interface ResponsePayload {
    output?: Array<{
      type: string
      content?: Array<{ type: string; text?: string }>
    }>
  }

  const payload = (await response.json()) as ResponsePayload
  const outputText =
    payload.output?.[0]?.content?.find((c) => c.type === 'output_text')?.text ?? ''

  try {
    const cleaned = outputText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const parsed = JSON.parse(cleaned) as ParsedIdeas
    return parsed.ideas ?? []
  } catch {
    return []
  }
}
