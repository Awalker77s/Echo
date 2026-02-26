export interface OpenAIInputMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function callOpenAIResponses(args: {
  apiKey: string
  model: string
  temperature?: number
  input: OpenAIInputMessage[]
}) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: args.model,
      temperature: args.temperature,
      input: args.input,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI responses API failed (${response.status}): ${text}`)
  }

  const payload = await response.json() as { output_text?: string }
  return payload.output_text ?? ''
}

export async function callWhisperTranscription(args: { apiKey: string; audio: File }) {
  const formData = new FormData()
  formData.append('model', 'whisper-1')
  formData.append('file', args.audio)

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI transcription API failed (${response.status}): ${text}`)
  }

  const payload = await response.json() as { text?: string }
  if (!payload.text) throw new Error('OpenAI transcription response missing text')
  return payload.text
}
