export function HeroForm({ onSubmit, values = {} }) {
  const el = document.createElement('form')
  el.className = 'card grid'
  el.innerHTML = `
    <div class="grid cols-2">
      <label>Name<br/><input class="input" name="name" required value="${values.name ?? ''}"/></label>
      <label>Klasse / Profession<br/><input class="input" name="klasse" value="${values.klasse ?? ''}"/></label>
    </div>
    <div class="grid cols-2">
      <label>Stufe<br/><input class="input" type="number" min="0" step="1" name="stufe" value="${values.stufe ?? 0}"/></label>
      <label>Bild (optional)<br/><input class="input" type="file" name="image" accept="image/*"/></label>
    </div>
    <label>Notizen<br/><textarea class="input" rows="5" name="notizen">${values.notizen ?? ''}</textarea></label>
    <div class="row" style="justify-content:flex-end;">
      <button class="btn">Speichern</button>
    </div>
  `
  el.addEventListener('submit', (e) => {
    e.preventDefault()
    const fd = new FormData(el)
    onSubmit({
      name: fd.get('name').toString().trim(),
      klasse: fd.get('klasse').toString().trim(),
      stufe: Number(fd.get('stufe') ?? 0),
      notizen: fd.get('notizen').toString(),
      imageFile: fd.get('image') instanceof File && fd.get('image').size ? fd.get('image') : null
    })
  })
  return el
}
