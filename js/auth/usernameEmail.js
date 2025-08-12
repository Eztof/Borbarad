// Wir „mappen“ den gewünschten Nutzernamen auf eine Fake-E-Mail.
// Damit funktioniert Supabase Auth ohne echte Mail.
export function usernameToEmail(username) {
  const clean = String(username || "").trim();
  if (!clean) return null;
  return `${clean}@borbarad.invalid`;
}
