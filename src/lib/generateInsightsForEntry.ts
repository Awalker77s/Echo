import { env } from './env'

export type InsightType = 'pattern' | 'reflection' | 'advice' | 'growth' | 'warning'

export interface GeneratedInsight {
  content: string
  insight_type: InsightType
}

interface ParsedInsights {
  insights: GeneratedInsight[]
}

const systemPrompt = `You are a personal growth and reflection assistant. Analyze this journal entry and generate meaningful insights about the person's thoughts, behaviors, and patterns. For each insight return:
- content: a thoughtful, personalized observation or piece of advice (2-3 sentences)
- insight_type: one of "pattern", "reflection", "advice", "growth", "warning"

Generate 4-8 insights that cover different aspects of the entry. Include a mix of insight types.

Return ONLY a valid JSON object in this format with no markdown fences:
{ "insights": [ { "content": "...", "insight_type": "..." } ] }`

export async function generateInsightsForEntry(entryText: string): Promise<GeneratedInsight[]> {
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

    const parsed = JSON.parse(cleaned) as ParsedInsights
    return parsed.insights ?? []
  } catch {
    return []
  }
}
