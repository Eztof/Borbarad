import { supabase } from './supabaseClient.js';


export const state = {
user: null,
campaignDate: null, // { year, month, day }
observers: new Set()
};


function notify(){
state.observers.forEach(fn=>fn(state));
}
export function subscribe(fn){ state.observers.add(fn); return ()=>state.observers.delete(fn); }


// Session laden
(async ()=>{
const { data: { session } } = await supabase.auth.getSession();
state.user = session?.user || null;
// Kampagnen-Datum aus localStorage
const raw = localStorage.getItem('campaignDate');
state.campaignDate = raw ? JSON.parse(raw) : { year: 1027, month: 1, day: 1 }; // Standard: 1. Praios 1027 BF
notify();
})();


export function setUser(u){ state.user = u; notify(); }
export function setCampaignDate(d){ state.campaignDate = d; localStorage.setItem('campaignDate', JSON.stringify(d)); notify(); }