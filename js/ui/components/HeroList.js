export function HeroList({ heroes, onOpen, onDelete }) {
  const el = document.createElement('div')
  el.className = 'card'
  if (!heroes.length) {
    el.innerHTML = '<p>Noch keine Helden. Lege deinen ersten an!</p>'
    return el
  }
  const ul = document.createElement('ul')
  ul.className = 'clean'
  heroes.forEach(h => {
    const li = document.createElement('li')
    li.style = 'display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #1f2a3a;'
    const thumb = document.createElement('img')
    thumb.className = 'thumb'
    thumb.src = h.img_url ?? ''
    thumb.alt = h.name
    thumb.onerror = () => { thumb.classList.add('hidden') }

    const meta = document.createElement('div')
    meta.innerHTML = `<div><strong>${h.name}</strong> <span class="badge">Stufe ${h.stufe ?? 0}</span></div>
      <div class="badge">${h.klasse ?? 'Unbekannt'}</div>`

    const actions = document.createElement('div')
    actions.style = 'margin-left:auto; display:flex; gap:8px;'
    const openBtn = document.createElement('button')
    openBtn.className = 'btn'
    openBtn.textContent = 'Öffnen'
    openBtn.addEventListener('click', () => onOpen(h))

    const delBtn = document.createElement('button')
    delBtn.className = 'btn danger'
    delBtn.textContent = 'Löschen'
    delBtn.addEventListener('click', () => onDelete(h))

    actions.append(openBtn, delBtn)
    li.append(thumb, meta, actions)
    ul.append(li)
  })
  el.append(ul)
  return el
}
