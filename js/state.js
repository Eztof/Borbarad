import { supabase } from './supabaseClient.js';

export const state = {
  user: null,
  campaignDate: null, // { year, month, day }
  observers: new Set()
};

function notify(){ state.observers.forEach(fn=>fn(state)); }
export function subscribe(fn){ state.observers.add(fn); return ()=>state.observers.delete(fn); }

// --- Helpers: Kampagnendatum in DB laden/speichern ---
async function loadCampaignDateFromDB(){
  try{
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key','campaign_date')
      .maybeSingle();
    if (error) throw error;
    if (data?.value){
      state.campaignDate = data.value;
      localStorage.setItem('campaignDate', JSON.stringify(state.campaignDate));
    }
  }catch(err){
    console.warn('load campaign_date:', err.message);
  }
}

function saveCampaignDateToDB(){
  if (!state.user) return; // nur wenn eingeloggt
  supabase
    .from('app_settings')
    .upsert({ key:'campaign_date', value: state.campaignDate })
    .then(({ error })=>{ if (error) console.warn('save campaign_date:', error.message); });
}

// Session laden + Kampagnen-Datum initialisieren
(async ()=>{
  const { data: { session } } = await supabase.auth.getSession();
  state.user = session?.user || null;

  // Zuerst aus localStorage, dann ggf. DB überschreibt
  const raw = localStorage.getItem('campaignDate');
  state.campaignDate = raw ? JSON.parse(raw) : { year: 1027, month: 1, day: 1 };

  if (state.user){
    await loadCampaignDateFromDB();
  }
  notify();
})();

export function setUser(u){
  state.user = u;
  if (u){
    // Nach Login die Settings aus DB laden
    loadCampaignDateFromDB().finally(()=>notify());
  }else{
    notify();
  }
}

export function setCampaignDate(d){
  state.campaignDate = d;
  localStorage.setItem('campaignDate', JSON.stringify(d));
  saveCampaignDateToDB();
  notify();
}
