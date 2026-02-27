import { env } from './env'
import type { IdeaEngineSettings, IdeaCategory } from '../types/ideaTree'

export interface EngineIdea {
  content: string
  category: IdeaCategory
  details: string
}

export function buildIdeaPrompt(params: {
  contextText: string
  selectedLabels: string[]
  settings: IdeaEngineSettings
}) {
  const { contextText, selectedLabels, settings } = params
  return `You are helping expand an evolving idea network.
Mode: ${settings.mode}
Creativity: ${settings.creativity}
Requested ideas: ${settings.nodeCount}
Depth limit: ${settings.depthLimit}
Selected nodes: ${selectedLabels.join(', ') || 'none'}

Context:\n${contextText}

Return strict JSON in this shape:
{"ideas":[{"content":"...","category":"business|creative|goal|action|other","details":"..."}]}
Keep content short and concrete.`
}

export async function generateIdeasFromContext(prompt: string, settings: IdeaEngineSettings): Promise<EngineIdea[]> {
  const apiKey = env.openAiKey
  if (!apiKey) throw new Error('OpenAI API key is not configured. Set VITE_OPENAI_API_KEY in your .env file.')

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: settings.creativity,
      instructions: 'Return only valid JSON.',
      input: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) throw new Error(`OpenAI API failed (${response.status})`)

  interface ResponsePayload {
    output?: Array<{ content?: Array<{ type: string; text?: string }> }>
  }
  const payload = (await response.json()) as ResponsePayload
  const outputText = payload.output?.[0]?.content?.find((c) => c.type === 'output_text')?.text ?? ''

  try {
    const cleaned = outputText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(cleaned) as { ideas?: EngineIdea[] }
    return (parsed.ideas ?? []).slice(0, settings.nodeCount)
  } catch {
    return []
  }
}
