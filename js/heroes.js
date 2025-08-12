import { supabase } from './supabaseClient.js'

// Typ: { id, name, klasse, stufe, notizen, img_path, created_at, owner }
export async function listHeroes() {
  const { data, error } = await supabase
    .from('heroes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getHero(id) {
  const { data, error } = await supabase.from('heroes').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createHero(payload) {
  const { data, error } = await supabase.from('heroes').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateHero(id, patch) {
  const { data, error } = await supabase.from('heroes').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteHero(id) {
  const { error } = await supabase.from('heroes').delete().eq('id', id)
  if (error) throw error
}
