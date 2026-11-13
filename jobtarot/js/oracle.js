// JobTarot core (pure: no DOM, no clock, no unseeded random - the rng is passed in). Shuffles the deck, scores a 3-card spread and composes
// the forecast. Score = past + present + 2 x future (good +1, chaos 0, bad -1), range -4..4 -> one of five verdict tiers.
// Variety (owner 2026-11-13: "частые повторения в итогах особенно на приметах"): every line of the verdict is drawn from a pool, and
// `recent` (a list of keys the caller keeps between readings) blocks the lines shown in the last readings. The special sign comes from the
// role's own list + the shared pool, so it no longer repeats per role.
(function (root) {
  const VAL = { good: 1, chaos: 0, bad: -1 };
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(list, r) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // a drawn card = { card, rev }: like a real deck, a card can come out reversed (upside down) and is then read with its reversed meaning
  const REV_CHANCE = 0.4;
  const draw = (card, r) => ({ card, rev: r() < REV_CHANCE });
  const vOf = (d) => (d.rev ? d.card.rv : d.card.v);
  function score(spread) { return VAL[vOf(spread[0])] + VAL[vOf(spread[1])] + 2 * VAL[vOf(spread[2])]; }
  function tierOf(s) { return s <= -3 ? 0 : s <= -1 ? 1 : s === 0 ? 2 : s <= 2 ? 3 : 4; }
  // pick one item of `items` ([key, text]) whose key is not in `recent`; falls back to the least recent when all were shown
  function pickFresh(items, recent, r) {
    const fresh = items.filter((it) => !recent.includes(it[0]));
    if (fresh.length) return fresh[Math.floor(r() * fresh.length)];
    return items.slice().sort((a, b) => recent.indexOf(a[0]) - recent.indexOf(b[0]))[0];
  }
  // spread = 3 drawn cards { card, rev } (past, present, future); role = ROLES entry; lang 'ru' | 'en'; recent = keys used lately (mutated: new keys pushed)
  function forecast(spread, role, lang, r, ui, recent = []) {
    const s = score(spread), tier = tierOf(s), U = ui[lang], used = [];
    const take = (items) => { const it = pickFresh(items, recent, r); used.push(it[0]); return it[1]; };
    const head = take(U.heads[tier].map((t, i) => [`h${tier}.${i}`, t]));
    const salary = take(U.salaries[tier].map((t, i) => [`s${tier}.${i}`, t]));
    const perk = take(role[lang].slice(1).map((t, i) => [`p.${role.id}.${i}`, t]).concat(U.perks.map((t, i) => [`p.${i}`, t])));
    const charm = take(U.charms.map((t, i) => [`c.${i}`, t]));
    const adv = (d) => [`a.${d.card.id}.${d.rev ? 'r' : 'u'}`, d.card[lang][d.rev ? 'radvice' : 'advice']];
    const advice = take([adv(spread[1]), adv(spread[2])].concat(U.tips.map((t, i) => [`t.${i}`, t])));
    const prob = Math.max(7, Math.min(99, Math.round(38 + s * 13 + (r() * 14 - 5))));
    recent.push(...used); while (recent.length > 24) recent.shift();
    return { score: s, tier, prob, head, when: spread[2].card[lang].when, salary, perk, charm, advice, used, lines: spread.map((d, i) => line(d, i, lang, U)) };
  }
  // the reading of one card in one position: real arcanum + its real keywords for this orientation + the job joke
  function line(d, i, lang, U) {
    const T = d.card[lang];
    return { pos: U.pos[i], name: T.name, arc: T.arc, rev: d.rev, key: d.rev ? T.down : T.up, v: vOf(d), text: d.rev ? T.rev : T[['past', 'present', 'future'][i]] };
  }
  root.Oracle = { VAL, REV_CHANCE, rng, shuffle, draw, vOf, score, tierOf, pickFresh, forecast, line };
})(typeof window !== 'undefined' ? window : module.exports);
