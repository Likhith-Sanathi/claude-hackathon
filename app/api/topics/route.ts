import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json([])
    }

    const conversationText = messages
      .slice(-6)
      .map((m: { role: string; text: string }) => `${m.role}: ${m.text}`)
      .join('\n')

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [
        {
          role: 'user',
          content: `Extract 3-5 short topic keywords from this conversation. Return ONLY a JSON array of strings, no explanation. Each keyword should be 1-3 words, lowercase.\n\nConversation:\n${conversationText}`,
        },
      ],
    })

    const text = response.content.find(b => b.type === 'text')?.text ?? '[]'
    const match = text.match(/\[[\s\S]*\]/)
    const topics: string[] = match ? JSON.parse(match[0]) : []
    return Response.json(topics.slice(0, 5))
  } catch (err) {
    console.error('Topics error:', err)
    return Response.json([])
  }
}
