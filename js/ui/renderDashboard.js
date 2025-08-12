import { listHeroes, createHero, updateHero, deleteHero } from '../heroes.js'
import { uploadHeroImage, getPublicUrl, removeImage } from '../storage.js'
import { HeroForm } from './components/HeroForm.js'
import { HeroList } from './components/HeroList.js'
import { supabase } from '../supabaseClient.js'

export async function renderDashboard(root) {
  root.innerHTML = ''
  const header = document.createElement('div')
  header.className = 'row'
  header.style = 'align-items:center; justify-content:space-between;'
  header.innerHTML = `<h2>Heldenverwaltung</h2>`
  const addBtn = document.createElement('button')
  addBtn.className = 'btn primary'
  addBtn.textContent = 'Neuen Helden anlegen'
  header.append(addBtn)

  const listWrap = document.createElement('div')
  listWrap.id = 'heroList'

  root.append(header, listWrap)

  async function refresh() {
    const heroes = await listHeroes()
    listWrap.innerHTML = ''
    listWrap.append(HeroList({
      heroes,
      onOpen: openHero,
      onDelete: async (h) => {
        if (!confirm(`Helden "${h.name}" löschen?`)) return
        await deleteHero(h.id)
        if (h.img_path) { try { await removeImage(h.img_path) } catch {} }
        await refresh()
      }
    }))
  }

  async function openHero(h) {
    const modal = document.createElement('div')
    modal.className = 'card'
    modal.innerHTML = `<h3>Held bearbeiten</h3>`
    const form = HeroForm({
      values: h,
      onSubmit: async (vals) => {
        let img_path = h.img_path
        let img_url = h.img_url
        if (vals.imageFile) {
          // alte weg?
          if (img_path) { try { await removeImage(img_path) } catch {} }
          img_path = (await uploadHeroImage(vals.imageFile, h.id)).path
          img_url = (await getPublicUrl(img_path))
        }
        await updateHero(h.id, {
          name: vals.name, klasse: vals.klasse, stufe: vals.stufe, notizen: vals.notizen,
          img_path, img_url
        })
        root.removeChild(modal)
        await refresh()
      }
    })
    modal.append(form)
    root.prepend(modal)
  }

  addBtn.addEventListener('click', async () => {
    const modal = document.createElement('div')
    modal.className = 'card'
    modal.innerHTML = `<h3>Neuer Held</h3>`
    const form = HeroForm({
      onSubmit: async (vals) => {
        const user = (await supabase.auth.getUser()).data.user
        const base = {
          name: vals.name, klasse: vals.klasse, stufe: vals.stufe, notizen: vals.notizen,
          owner: user.id
        }
        let img_path = null, img_url = null
        if (vals.imageFile) {
          // temporär Dummy-ID, danach updaten
          const temp = await createHero(base)
          img_path = (await uploadHeroImage(vals.imageFile, temp.id)).path
          img_url = (await getPublicUrl(img_path))
          await updateHero(temp.id, { img_path, img_url })
        } else {
          await createHero(base)
        }
        root.removeChild(modal)
        await refresh()
      }
    })
    modal.append(form)
    root.prepend(modal)
  })

  await refresh()
}
