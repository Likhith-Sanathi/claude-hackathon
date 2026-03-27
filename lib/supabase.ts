import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface SessionEntry {
  id?: string
  created_at?: string
  transcript: { role: string; text: string }[]
  user_id?: string | null
}

export async function saveSession(transcript: { role: string; text: string }[]) {
  if (!supabaseUrl || !supabaseAnonKey) return null

  const { data, error } = await supabase
    .from('sessions')
    .insert({ transcript, user_id: null })
    .select()
    .single()

  if (error) {
    console.error('Supabase save error:', error)
    return null
  }

  return data
}
