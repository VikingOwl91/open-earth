/**
 * Open Earth - Regional Volcano Monitoring Providers
 * Multi-agency regional observatory status adapters:
 * - PVMBG / MAGMA Indonesia (Indonesia)
 * - USGS Volcano Hazards Program (United States)
 * - Japan Meteorological Agency / JMA (Japan)
 * - GeoNet / GNS Science (New Zealand)
 *
 * Preserves native alert scales, provider terminology, and snapshot freshness.
 */
(() => {
  'use strict';

  const providers = {
    pvmbg: { id: 'pvmbg', name: 'PVMBG / MAGMA Indonesia', url: 'https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas', file: 'pvmbg-status.json', statuses: [], fetchedAt: null },
    usgs: { id: 'usgs', name: 'USGS Volcano Hazards Program', url: 'https://volcanoes.usgs.gov/hans-public/', file: 'usgs-volcano-status.json', statuses: [], fetchedAt: null },
    jma: { id: 'jma', name: 'Japan Meteorological Agency', url: 'https://www.jma.go.jp/bosai/map.html#contents=volcano', file: 'jma-volcano-status.json', statuses: [], fetchedAt: null },
    geonet: { id: 'geonet', name: 'GeoNet New Zealand (GNS Science)', url: 'https://www.geonet.org.nz/volcano', file: 'geonet-volcano-status.json', statuses: [], fetchedAt: null }
  };

  const normStr = s => typeof norm === 'function' ? norm(s) : String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const getVal = (...xs) => typeof value === 'function' ? value(...xs) : xs.find(x => x !== undefined && x !== null && String(x).trim() !== '' && String(x).trim().toLowerCase() !== 'unknown') ?? null;

  const pvmbgAliases = {
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
    'lewotobi': 'lewotobi'
  };

  const keyPvmbg = s => {
    const n = normStr(s);
    return pvmbgAliases[n] || n;
  };

  function relativeAge(t) {
    if (!t) return null;
    const ms = Date.now() - new Date(t).getTime();
    if (!Number.isFinite(ms)) return null;
    const h = Math.max(0, Math.floor(ms / 36e5));
    return h < 1 ? '< 1h old' : h < 48 ? `${h}h old` : `${Math.floor(h / 24)}d old`;
  }

  function normalizeRecord(providerId, s) {
    const p = providers[providerId];
    const age = relativeAge(p.fetchedAt);
    if (providerId === 'pvmbg') {
      const lvl = String(s.level || '').toUpperCase();
      const label = s.label || '';
      const badgeText = lvl ? `LEVEL ${lvl} · ${label.toUpperCase()}` : label.toUpperCase();
      const sev = lvl === 'IV' ? 'warning' : lvl === 'III' ? 'watch' : lvl === 'II' ? 'advisory' : 'normal';
      return {
        providerId: 'pvmbg',
        providerName: p.name,
        name: s.name,
        volcanoNumber: s.volcanoNumber != null ? Number(s.volcanoNumber) : null,
        matchingMethod: s.matchingMethod || 'catalog_match',
        level: lvl,
        label: badgeText,
        nativeStatus: s.nativeStatus || (lvl ? `Level ${lvl} - ${label}` : label),
        severity: sev,
        reportUrl: s.reportUrl,
        sourceUrl: p.url,
        snapshotAge: age,
        provenance: 'Official Indonesian volcano hazard activity level published by PVMBG / MAGMA Indonesia.',
        note: 'Official Indonesian activity level. Independent of the GVP weekly report.'
      };
    }
    if (providerId === 'usgs') {
      return {
        providerId: 'usgs',
        providerName: p.name,
        name: s.name,
        volcanoNumber: s.volcanoNumber != null ? Number(s.volcanoNumber) : null,
        matchingMethod: s.matchingMethod || 'official_vnum',
        level: s.alertLevel,
        colorCode: s.colorCode,
        label: s.label || s.nativeStatus,
        nativeStatus: s.nativeStatus,
        severity: s.severity || 'normal',
        observatory: s.observatory,
        observedAt: s.observedAt,
        reportUrl: s.reportUrl,
        sourceUrl: p.url,
        snapshotAge: age,
        provenance: s.provenance || 'Official alert level and aviation color code from USGS Volcano Hazards Program.',
        note: s.observatory ? `${s.observatory} alert level. Independent of the GVP weekly report.` : null
      };
    }
    if (providerId === 'jma') {
      return {
        providerId: 'jma',
        providerName: p.name,
        name: s.name,
        nameJp: s.nameJp,
        volcanoNumber: s.volcanoNumber != null ? Number(s.volcanoNumber) : null,
        matchingMethod: s.matchingMethod || 'curated_jma_code',
        level: s.level,
        label: s.label || s.nativeStatus,
        nativeStatus: s.nativeStatus,
        severity: s.severity || 'normal',
        observedAt: s.observedAt,
        reportUrl: s.reportUrl,
        sourceUrl: p.url,
        snapshotAge: age,
        provenance: s.provenance || 'Official volcanic warning published by the Japan Meteorological Agency (JMA).',
        note: s.note ? `${s.note}. Official JMA advisory.` : 'Official JMA volcanic warning. Independent of the GVP weekly report.'
      };
    }
    if (providerId === 'geonet') {
      return {
        providerId: 'geonet',
        providerName: p.name,
        name: s.name,
        volcanoNumber: s.volcanoNumber != null ? Number(s.volcanoNumber) : null,
        matchingMethod: s.matchingMethod || 'curated_geonet_id',
        level: s.level,
        colorCode: s.colorCode,
        label: s.label || s.nativeStatus,
        nativeStatus: s.nativeStatus,
        severity: s.severity || 'normal',
        activity: s.activity,
        hazards: s.hazards,
        reportUrl: s.reportUrl,
        sourceUrl: p.url,
        snapshotAge: age,
        provenance: s.provenance || 'Official New Zealand Volcanic Alert Level published by GeoNet / GNS Science.',
        note: s.hazards ? `${s.hazards}` : 'Official GeoNet alert level. Independent of the GVP weekly report.'
      };
    }
    return s;
  }

  function matchPvmbg(p, vnum, rawName, country) {
    if (!/indonesia/i.test(country)) return null;
    if (vnum) {
      const byNum = providers.pvmbg.statuses.find(s => s.volcanoNumber != null && String(s.volcanoNumber) === vnum);
      if (byNum) return normalizeRecord('pvmbg', byNum);
    }
    const n = keyPvmbg(rawName);
    if (!n) return null;
    if (n === 'sumbing' && !vnum) return null;
    const hit = providers.pvmbg.statuses.find(s => keyPvmbg(s.name) === n);
    return hit ? normalizeRecord('pvmbg', hit) : null;
  }

  function matchUsgs(p, vnum, rawName, country) {
    if (!/(united states|mariana|pacific|alaska|hawaii)/i.test(country)) return null;
    if (vnum) {
      const byNum = providers.usgs.statuses.find(s => s.volcanoNumber != null && String(s.volcanoNumber) === vnum);
      if (byNum) return normalizeRecord('usgs', byNum);
    }
    const target = normStr(rawName).replace(/^mount/, '');
    if (!target) return null;
    const hit = providers.usgs.statuses.find(s => {
      const sn = normStr(s.name).replace(/^mount/, '');
      return sn === target || sn === normStr(rawName);
    });
    return hit ? normalizeRecord('usgs', hit) : null;
  }

  function matchJma(p, vnum, rawName, country) {
    if (!/japan/i.test(country)) return null;
    if (vnum) {
      const byNum = providers.jma.statuses.find(s => s.volcanoNumber != null && String(s.volcanoNumber) === vnum);
      if (byNum) return normalizeRecord('jma', byNum);
    }
    const target = normStr(rawName);
    if (!target) return null;
    const hit = providers.jma.statuses.find(s => normStr(s.name) === target || normStr(s.nameJp) === target);
    return hit ? normalizeRecord('jma', hit) : null;
  }

  function matchGeoNet(p, vnum, rawName, country) {
    if (!/new zealand/i.test(country)) return null;
    if (vnum) {
      const byNum = providers.geonet.statuses.find(s => s.volcanoNumber != null && String(s.volcanoNumber) === vnum);
      if (byNum) return normalizeRecord('geonet', byNum);
    }
    const target = normStr(rawName);
    if (!target) return null;
    const hit = providers.geonet.statuses.find(s => normStr(s.name) === target);
    return hit ? normalizeRecord('geonet', hit) : null;
  }

  function regionalMonitoringForVolcano(p) {
    if (!p) return [];
    const vnum = String(getVal(p?.Volcano_Number, p?.VolcanoNumber, p?.volcano_number, '')).trim();
    const country = String(getVal(p?.Country, p?.country, '')).toLowerCase();
    const rawName = getVal(p?.Volcano_Name, p?.VolcanoName, p?.Report_Name, '');

    const records = [];
    const pv = matchPvmbg(p, vnum, rawName, country);
    if (pv) records.push(pv);

    const us = matchUsgs(p, vnum, rawName, country);
    if (us) records.push(us);

    const jm = matchJma(p, vnum, rawName, country);
    if (jm) records.push(jm);

    const gn = matchGeoNet(p, vnum, rawName, country);
    if (gn) records.push(gn);

    return records;
  }

  async function loadProvider(id) {
    const p = providers[id];
    try {
      const r = await fetch(`./data/${p.file}`, { cache: 'no-cache' });
      if (!r.ok) throw Error(r.status);
      const d = await r.json();
      p.statuses = Array.isArray(d.statuses) ? d.statuses : [];
      p.fetchedAt = d.fetchedAt || null;
    } catch (e) {
      console.warn(`Regional volcano provider ${p.name} snapshot unavailable`, e);
    }
  }

  let loadPromise = null;
  function loadAll() {
    if (!loadPromise) {
      loadPromise = Promise.all(Object.keys(providers).map(loadProvider)).then(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('openearth:regional-monitoring-ready', {
            detail: {
              pvmbg: providers.pvmbg.statuses.length,
              usgs: providers.usgs.statuses.length,
              jma: providers.jma.statuses.length,
              geonet: providers.geonet.statuses.length
            }
          }));
        }
      });
    }
    return loadPromise;
  }

  const Providers = {
    providers,
    loadAll,
    regionalMonitoringForVolcano,
    relativeAge
  };

  if (typeof window !== 'undefined') {
    window.OpenEarth = window.OpenEarth || {};
    window.OpenEarth.providers = Providers;
    // Backward compatibility globals
    window.regionalMonitoringForVolcano = regionalMonitoringForVolcano;
    window.pvmbgForVolcano = p => regionalMonitoringForVolcano(p).find(r => r.providerId === 'pvmbg') || null;
    window.pvmbgSnapshotAge = () => relativeAge(providers.pvmbg.fetchedAt);
    window.regionalProviders = providers;
    window.regionalProviderAges = () => ({
      pvmbg: relativeAge(providers.pvmbg.fetchedAt),
      usgs: relativeAge(providers.usgs.fetchedAt),
      jma: relativeAge(providers.jma.fetchedAt),
      geonet: relativeAge(providers.geonet.fetchedAt)
    });
    // Auto-load on script execution
    loadAll();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Providers;
  }
})();
