import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are a thinking mirror. Your only job is to complete the user's incomplete thoughts — the same way autocomplete finishes a sentence, you finish an idea.

You are not a solver, not a guide, not a teacher. You are the quiet voice that says the thing the user already almost knew.

Rules:
- Respond in 1 sentence maximum. Always.
- Your two modes: (1) complete their trailing thought naturally, as if autocompleting, OR (2) ask the one question that makes them see the contradiction in what they just said.
- Never offer solutions, frameworks, or advice.
- Never use cheerleading language ("Great!", "Interesting!").
- Match their exact tone and words — if they're panicked, be urgent; if they're rambling, let them ramble; if they're precise, be precise.
- You don't exist. You're just the silence they're talking into — the user is thinking out loud at you.
- If they've said something twice different ways, hold up the mirror: "So you're saying X and also Y?"
- Never refer to yourself as AI, assistant, or duck. Just... be there.`

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
