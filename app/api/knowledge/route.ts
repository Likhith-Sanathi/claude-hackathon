import { NextRequest } from 'next/server'
import { getAllKnowledge, addKnowledge, deleteKnowledge } from '@/lib/db'

export async function GET() {
  try {
    const entries = getAllKnowledge()
    return Response.json(entries)
  } catch (err) {
    console.error('Knowledge GET error:', err)
    return new Response('Failed to load knowledge', { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { content, source } = await req.json()
    if (!content || typeof content !== 'string') {
      return new Response('Missing content', { status: 400 })
    }
    const entry = addKnowledge(content.trim(), source ?? 'user')
    return Response.json(entry, { status: 201 })
  } catch (err) {
    console.error('Knowledge POST error:', err)
    return new Response('Failed to save knowledge', { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = Number(searchParams.get('id'))
    if (!id) return new Response('Missing id', { status: 400 })
    deleteKnowledge(id)
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error('Knowledge DELETE error:', err)
    return new Response('Failed to delete knowledge', { status: 500 })
  }
}
