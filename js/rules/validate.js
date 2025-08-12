// Prereq-Format: { "all": [ cond | group ], "any": [ ... ] }
// cond: { attr:"MU", ">=":12 } | { trait:"Goldgier", ">=":5 } | { sa:"Aufmerksamkeit" }
// Ein Objekt darf "all" und/oder "any" enthalten. Leerer/fehlender Block => true.

export function checkPrereq(pr, ctx) {
  if (!pr) return { ok: true, fails: [] };
  const fails = [];
  const ok = evalGroup(pr, ctx, fails);
  return { ok, fails };
}

function evalGroup(node, ctx, fails) {
  let okAll = true, okAny = (node.any ? false : true);

  if (node.all) {
    for (const x of node.all) {
      const r = isGroup(x) ? evalGroup(x, ctx, fails) : evalCond(x, ctx, fails);
      if (!r) okAll = false;
    }
  }
  if (node.any) {
    for (const x of node.any) {
      const r = isGroup(x) ? evalGroup(x, ctx, fails) : evalCond(x, ctx, fails);
      if (r) { okAny = true; break; }
    }
  }
  return okAll && okAny;
}

function isGroup(x) { return x && (x.all || x.any); }

function evalCond(c, ctx, fails) {
  // Attribute
  if (c.attr) {
    const val = (ctx.attributes || {})[c.attr] ?? 0;
    const ok = compare(val, c);
    if (!ok) fails.push(`${c.attr} ${opText(c)} ${c.value ?? c["<="] ?? c[">="] ?? c["="] ?? "?"}`);
    return ok;
  }
  // Trait-Level
  if (c.trait) {
    const lvl = ctx.traits.get(c.trait) ?? 0;
    const ok = compare(lvl, c);
    if (!ok) fails.push(`Voraussetzung: ${c.trait} ${opText(c)} ${valFrom(c)}`);
    return ok;
  }
  // SF-Vorhanden
  if (c.sa) {
    const has = ctx.sas.has(c.sa);
    const ok = c["="] ? (has === c["="]) : has; // Default: muss vorhanden sein
    if (!ok) fails.push(`Sonderfertigkeit „${c.sa}“ fehlt`);
    return ok;
  }
  return true;
}

function compare(val, c) {
  if (c[">="] != null) return val >= c[">="];
  if (c["<="] != null) return val <= c["<="];
  if (c[">"]  != null) return val >  c[">"];
  if (c["<"]  != null) return val <  c["<"];
  if (c["="]  != null) return val === c["="];
  if (c.value != null) return val >= c.value;
  return true;
}
function opText(c) {
  if (c[">="]!=null) return "≥";
  if (c["<="]!=null) return "≤";
  if (c[">"] !=null) return ">";
  if (c["<"] !=null) return "<";
  if (c["="] !=null) return "=";
  return "≥";
}
function valFrom(c){ return c[">="] ?? c["<="] ?? c[">"] ?? c["<"] ?? c["="] ?? c.value ?? "?"; }
