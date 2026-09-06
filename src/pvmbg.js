/* Regional volcano monitoring: PVMBG / MAGMA Indonesia snapshot. */
(() => {
  let statuses = [], fetchedAt = null;

  const normStr = s => typeof norm === 'function' ? norm(s) : String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const getVal = (...xs) => typeof value === 'function' ? value(...xs) : xs.find(x => x !== undefined && x !== null && String(x).trim() !== '' && String(x).trim().toLowerCase() !== 'unknown') ?? null;

  const aliases = {
    'anakkrakatau': 'krakatau',
    'krakatau': 'krakatau',
    'anakranakah': 'ranakah',
    'ranakah': 'ranakah',
    'batutara': 'tarabatu',
    'tarabatu': 'tarabatu',
    'bromo': 'tenggercaldera',
    'tenggercaldera': 'tenggercaldera',
    'burnitelong': 'telongburni',
    'telongburni': 'telongburni',
    'dieng': 'diengvolcaniccomplex',
    'diengvolcaniccomplex': 'diengvolcaniccomplex',
    'gede': 'gedepangrango',
    'gedepangrango': 'gedepangrango',
    'ilewerung': 'iliwerung',
    'iliwerung': 'iliwerung',
    'ililewotolok': 'lewotolok',
    'lewotolok': 'lewotolok',
    'lokon': 'lokonempung',
    'lokonempung': 'lokonempung',
    'peutsague': 'peuetsague',
    'peuetsague': 'peuetsague',
    'rokatenda': 'paluweh',
    'paluweh': 'paluweh',
    'tandikat': 'tandikatsinggalang',
    'tandikatsinggalang': 'tandikatsinggalang',
    'tangkoko': 'tangkokoduasudara',
    'tangkokoduasudara': 'tangkokoduasudara',
    'lewotobilakilaki': 'lewotobi',
    'lewotobi': 'lewotobi',
  };

  const key = s => {
    const n = normStr(s);
    return aliases[n] || n;
  };

  window.pvmbgForVolcano = p => {
    if (!/indonesia/i.test(String(getVal(p?.Country, p?.country, '')))) return null;

    // 1. Explicit GVP Volcano_Number matching where available
    const vnum = String(getVal(p?.Volcano_Number, p?.VolcanoNumber, p?.volcano_number, '')).trim();
    if (vnum) {
      const byNum = statuses.find(s => s.volcanoNumber != null && String(s.volcanoNumber) === vnum);
      if (byNum) return byNum;
    }

    // 2. Normalized exact names and curated aliases
    const rawName = getVal(p?.Volcano_Name, p?.VolcanoName, p?.Report_Name, '');
    const n = key(rawName);
    if (!n) return null;

    // Guard against ambiguous cross-matching for duplicate names without number
    if (n === 'sumbing' && !vnum) return null;

    return statuses.find(s => key(s.name) === n) || null;
  };

  window.pvmbgSnapshotAge = () => fetchedAt ? relativeAge(fetchedAt) : null;

  function relativeAge(t) {
    const ms = Date.now() - new Date(t).getTime();
    if (!Number.isFinite(ms)) return null;
    const h = Math.max(0, Math.floor(ms / 36e5));
    return h < 1 ? '< 1h old' : h < 48 ? `${h}h old` : `${Math.floor(h / 24)}d old`;
  }

  async function load() {
    try {
      const r = await fetch('./data/pvmbg-status.json', { cache: 'no-cache' });
      if (!r.ok) throw Error(r.status);
      const d = await r.json();
      statuses = Array.isArray(d.statuses) ? d.statuses : [];
      fetchedAt = d.fetchedAt || null;
      window.dispatchEvent(new CustomEvent('openearth:pvmbg-ready', { detail: { count: statuses.length } }));
    } catch (e) {
      console.warn('PVMBG status snapshot unavailable', e);
    }
  }

  load();
})();

