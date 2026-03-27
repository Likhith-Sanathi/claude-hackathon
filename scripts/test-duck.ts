#!/usr/bin/env npx tsx
/**
 * Test the /api/duck route directly via the Anthropic SDK.
 * Run: npx tsx scripts/test-duck.ts
 */

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

const TEST_CASES = [
  "I keep thinking my bug is in the database layer but I already checked it twice and it seems fine...",
  "So the issue is that users aren't converting and I think it's because the onboarding is too long but also maybe the pricing is wrong",
  "I want to refactor this whole module but I'm not sure if I should do it now or wait until after the release",
  "Every time I fix one test, three others break. I don't even know where to start.",
]

async function testDuck(transcript: string, history: { role: 'user' | 'assistant'; content: string }[] = []) {
  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: 'user', content: transcript },
  ]

  process.stdout.write('\n\x1b[90m> ' + transcript + '\x1b[0m\n')
  process.stdout.write('\x1b[33m🦆 ')

  const stream = await client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    system: SYSTEM_PROMPT,
    messages,
  })

  let fullResponse = ''
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      process.stdout.write(chunk.delta.text)
      fullResponse += chunk.delta.text
    }
  }

  process.stdout.write('\x1b[0m\n')
  return fullResponse
}

async function main() {
  console.log('\x1b[1m\x1b[37mQuack — Duck API Test\x1b[0m')
  console.log('\x1b[90m' + '─'.repeat(60) + '\x1b[0m')

  for (const transcript of TEST_CASES) {
    await testDuck(transcript)
    await new Promise(r => setTimeout(r, 300))
  }

  // Multi-turn conversation test
  console.log('\n\x1b[90m' + '─'.repeat(60) + '\x1b[0m')
  console.log('\x1b[1m\x1b[37mMulti-turn conversation:\x1b[0m')

  const history: { role: 'user' | 'assistant'; content: string }[] = []

  const turns = [
    "I have this function that does three things and I know I should split it up...",
    "Well it handles auth, then fetches data, then formats it for the UI",
    "I guess the UI formatting is the weird one because it has business logic in it",
  ]

  for (const turn of turns) {
    const response = await testDuck(turn, history)
    history.push({ role: 'user', content: turn })
    history.push({ role: 'assistant', content: response })
    await new Promise(r => setTimeout(r, 300))
  }

  console.log('\n\x1b[90m' + '─'.repeat(60) + '\x1b[0m\n')
}

main().catch(console.error)
