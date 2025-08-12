import { supabase } from './supabaseClient.js'

// Bucket-Name in Supabase: 'hero-images' (siehe Setup unten)
const BUCKET = 'hero-images'

export async function uploadHeroImage(file, heroId) {
  const ext = file.name.split('.').pop()
  const path = `${heroId}/${crypto.randomUUID()}.${ext}`
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
  if (error) throw error
  return data.path
}

export async function getPublicUrl(path) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function removeImage(path) {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}
