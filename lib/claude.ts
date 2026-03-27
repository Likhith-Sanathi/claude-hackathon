export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

const SYSTEM_PROMPT = `You are a rubber duck. Your only job is to help the user think — never to solve their problem for them.

Rules:
- Respond in 1 sentence maximum. Always.
- Never give answers, solutions, or advice.
- Either: complete a trailing thought naturally (like autocomplete), OR ask one minimal, open-ended clarifying question.
- Match the user's tone and vocabulary exactly.
- If the user has said something contradictory, gently surface it as a question.
- Never use filler phrases like "Great point!" or "Interesting!".
- Never refer to yourself as an AI.
- Respond as if you are a quiet, thoughtful presence — not an assistant.`

export async function sendToDuck(
  transcript: string,
  history: ConversationMessage[]
): Promise<ReadableStream<string>> {
  const response = await fetch('/api/duck', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, history }),
  })

  if (!response.ok) {
    throw new Error(`Duck API error: ${response.status}`)
  }

  return response.body as unknown as ReadableStream<string>
}

export { SYSTEM_PROMPT }
