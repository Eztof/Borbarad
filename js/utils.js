// Aventurischer Kalender – simple Umsetzung: 12 Monate à 30 Tage
export const AV_MONTHS = [
'Praios','Rondra','Efferd','Travia','Boron','Hesinde','Firun','Tsa','Phex','Peraine','Ingerimm','Rahja'
];

// Epochale Zuordnung zu ISO (für FullCalendar/Timeline rein technisch)
const ISO_EPOCH = '2000-01-01'; // beliebig, nur konsistent

function pad(n){ return String(n).padStart(2,'0'); }

export function formatAvDate({year, month, day}){
  const m = AV_MONTHS[month-1] || `Monat ${month}`;
  return `${day}. ${m} ${year} BF`;
}

// Umrechnungen: Aventurisch <-> fortlaufender Tag (ab 1 Praios 0 BF)
export function avToDayNumber({year, month, day}){
  const y = Number(year), m = Number(month), d = Number(day);
  return y * 360 + (m-1) * 30 + (d-1); // 360 Tage/Jahr
}
export function dayNumberToAv(num){
  const year = Math.floor(num/360);
  const rem = num % 360;
  const month = Math.floor(rem/30)+1;
  const day = (rem % 30)+1;
  return { year, month, day };
}

// ISO Datum nur für Visualisierung (Epoch + Tage)
export function avToISO(av){
  const n = avToDayNumber(av);
  const base = new Date(ISO_EPOCH);
  base.setDate(base.getDate() + n);
  const y = base.getUTCFullYear();
  const m = pad(base.getUTCMonth()+1);
  const d = pad(base.getUTCDate());
  return `${y}-${m}-${d}`;
}
export function isoToAv(iso){
  const base = new Date(ISO_EPOCH);
  const cur = new Date(iso);
  const diffDays = Math.round((cur - base)/86400000);
  return dayNumberToAv(diffDays);
}

export function datePickerAv(idPrefix, value){
  const y = value?.year ?? 1027;
  const m = value?.month ?? 1;
  const d = value?.day ?? 1;
  return `
  <div class="row">
  <div>
  <div class="label">Tag</div>
  <input class="input" id="${idPrefix}-day" type="number" min="1" max="30" value="${d}">
  </div>
  <div>
  <div class="label">Monat</div>
  <select class="input" id="${idPrefix}-month">
  ${AV_MONTHS.map((nm, idx)=>`<option value="${idx+1}" ${idx+1===Number(m)?'selected':''}>${nm}</option>`).join('')}
  </select>
  </div>
  </div>
  <div>
  <div class="label">Jahr (BF)</div>
  <input class="input" id="${idPrefix}-year" type="number" value="${y}">
  </div>`;
}
export function readDatePickerAv(idPrefix){
  return {
    day: Number(document.getElementById(`${idPrefix}-day`).value),
    month: Number(document.getElementById(`${idPrefix}-month`).value),
    year: Number(document.getElementById(`${idPrefix}-year`).value)
  };
}

export function htmlesc(str){
  return String(str).replace(/[&<>"']/g, ch => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  })[ch]);
}

export function byStr(field){
  return (a,b)=> String(a?.[field]??'').localeCompare(String(b?.[field]??''));
}

export function uid(){ return Math.random().toString(36).slice(2); }
