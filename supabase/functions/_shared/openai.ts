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
  // The Responses API uses "instructions" for system-level prompts and does
  // not accept role:"system" in the input array. Extract system messages into
  // the "instructions" field and pass everything else as input.
  const systemMessages = args.input.filter((m) => m.role === 'system')
  const conversationMessages = args.input.filter((m) => m.role !== 'system')

  const body: Record<string, unknown> = {
    model: args.model,
    input: conversationMessages,
  }

  if (args.temperature !== undefined) {
    body.temperature = args.temperature
  }

  if (systemMessages.length > 0) {
    body.instructions = systemMessages.map((m) => m.content).join('\n\n')
  }

  console.log(`[openai] Calling Responses API (model=${args.model}, instructions=${systemMessages.length > 0 ? 'yes' : 'none'}, messages=${conversationMessages.length})`)

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error(`[openai] Responses API error (${response.status}):`, text)
    throw new Error(`OpenAI responses API failed (${response.status}): ${text}`)
  }

  // The raw Responses API JSON does NOT have a top-level `output_text` field.
  // That accessor only exists on the OpenAI SDK wrapper objects. In the raw
  // REST response the generated text lives at output[0].content[?].text where
  // the content item has type "output_text".
  interface ResponsePayload {
    output?: Array<{
      type: string
      content?: Array<{ type: string; text?: string }>
    }>
  }
  const payload = await response.json() as ResponsePayload
  const outputText =
    payload.output?.[0]?.content?.find((c) => c.type === 'output_text')?.text ?? ''
  console.log(`[openai] Responses API returned ${outputText.length} chars`)
  return outputText
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
