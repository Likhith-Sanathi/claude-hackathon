import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

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

export async function POST(req: NextRequest) {
  try {
    const { transcript, history = [] } = await req.json()

    if (!transcript || typeof transcript !== 'string') {
      return new Response('Missing transcript', { status: 400 })
    }

    // Build conversation messages (last 6 exchanges = 12 messages)
    const messages: Anthropic.MessageParam[] = [
      ...history.slice(-12).map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: transcript },
    ]

    const stream = await client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: SYSTEM_PROMPT,
      messages,
    })

    // Stream the response as plain text
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text))
            }
          }
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Duck API error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
