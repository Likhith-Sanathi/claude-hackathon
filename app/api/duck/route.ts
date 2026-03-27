import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const PROMPTS = {
  mirror: `You are a thinking mirror. Your only job is to complete the user's incomplete thoughts — the same way autocomplete finishes a sentence, you finish an idea.

You are not a solver, not a guide, not a teacher. You are the quiet voice that says the thing the user already almost knew.

Rules:
- Respond in 1 sentence maximum. Always.
- Your two modes: (1) complete their trailing thought naturally, as if autocompleting, OR (2) ask the one question that makes them see the contradiction in what they just said.
- Never offer solutions, frameworks, or advice.
- Never use cheerleading language ("Great!", "Interesting!").
- Match their exact tone and words — if they're panicked, be urgent; if they're rambling, let them ramble; if they're precise, be precise.
- You don't exist. You're just the silence they're talking into — the user is thinking out loud at you.
- If they've said something twice different ways, hold up the mirror: "So you're saying X and also Y?"
- Never refer to yourself as AI, assistant, or duck. Just... be there.`,

  assistant: `You are a calm, knowledgeable voice companion. Answer clearly and helpfully.

You have access to a web_search tool. Use it when:
- The user asks about current events, recent news, or real-time data.
- You are not confident your training data is up to date for the topic.
- The user asks about something that changes over time (prices, scores, weather, etc.).
Do NOT search for timeless facts you already know well.

Rules:
- Be warm but not performative. No sycophancy, no filler phrases ("Great question!", "Absolutely!").
- Keep responses short — 1 to 3 sentences unless the user explicitly asks for more.
- If you don't know something, say so plainly.
- Match the user's tone: casual if they're casual, precise if they're precise.
- Never refer to yourself as an AI. Just respond as a thoughtful, present voice.`,
}

const WEB_SEARCH_TOOL: Anthropic.Tool = {
  name: 'web_search',
  description:
    'Search the web for current information, recent events, or real-time data. Use when your training knowledge may be outdated or incomplete for the question.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'The search query' },
    },
    required: ['query'],
  },
}

async function runWebSearch(query: string): Promise<string> {
  const apiKey = process.env.LANGSEARCH_API_KEY
  if (!apiKey) return 'Web search is unavailable.'

  try {
    const res = await fetch('https://api.langsearch.com/v1/web-search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, freshness: 'noLimit', summary: true, count: 5 }),
    })

    if (!res.ok) return 'Web search failed.'

    const data = await res.json()
    const results: Array<{ name: string; url: string; summary?: string; snippet?: string }> =
      data?.data?.webPages?.value ?? []

    if (!results.length) return 'No results found.'

    return results
      .slice(0, 5)
      .map(r => `**${r.name}**\n${r.url}\n${r.summary || r.snippet || ''}`)
      .join('\n\n')
  } catch {
    return 'Web search failed.'
  }
}

function streamText(text: string): Response {
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text))
      controller.close()
    },
  })
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const { transcript, history = [], mode = 'mirror' } = await req.json()

    if (!transcript || typeof transcript !== 'string') {
      return new Response('Missing transcript', { status: 400 })
    }

    const messages: Anthropic.MessageParam[] = [
      ...history.slice(-12).map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: transcript },
    ]

    const systemPrompt = PROMPTS[mode as keyof typeof PROMPTS] ?? PROMPTS.mirror
    const maxTokens = mode === 'assistant' ? 400 : 150
    const useTools = mode === 'assistant' && !!process.env.LANGSEARCH_API_KEY

    // --- Assistant mode: non-streaming first pass to check for tool use ---
    if (useTools) {
      const first = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        system: systemPrompt,
        tools: [WEB_SEARCH_TOOL],
        messages,
      })

      const toolUseBlock = first.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      )

      if (toolUseBlock && toolUseBlock.name === 'web_search') {
        const query = (toolUseBlock.input as { query: string }).query
        const searchResults = await runWebSearch(query)

        // Second pass: stream final answer with search results injected
        const messagesWithResults: Anthropic.MessageParam[] = [
          ...messages,
          { role: 'assistant' as const, content: first.content },
          {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result' as const,
                tool_use_id: toolUseBlock.id,
                content: searchResults,
              },
            ],
          },
        ]

        const stream = await client.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: messagesWithResults,
        })

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
      }

      // No tool use — return the text Claude already generated
      const textBlock = first.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
      return streamText(textBlock?.text ?? '')
    }

    // --- Mirror mode (or no search key): plain streaming ---
    const stream = await client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    })

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
