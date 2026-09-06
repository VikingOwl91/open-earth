/**
 * Open Earth - Spatial & Geometry Utilities
 * Pure functions for geodesic distance, line segmentation, polygon containment,
 * and text normalization.
 */
(() => {
  'use strict';

  const esc = s => String(s ?? 'Unknown').replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function value(...xs) {
    return xs.find(x => x !== undefined && x !== null && String(x).trim() !== '' && String(x).trim().toLowerCase() !== 'unknown') ?? null;
  }

  function fmtDate(raw) {
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.valueOf())
      ? String(raw)
      : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  const rad = x => (x * Math.PI) / 180;

  function haversine(a, b) {
    if (!a || !b || a.length < 2 || b.length < 2) return Infinity;
    const dlat = rad(b[1] - a[1]);
    const dlon = rad(b[0] - a[0]);
    const x = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dlon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function segments(g) {
    const out = [];
    if (!g) return out;
    const walk = c => {
      if (typeof c?.[0] === 'number') return;
      if (typeof c?.[0]?.[0] === 'number') {
        for (let i = 1; i < c.length; i++) out.push([c[i - 1], c[i]]);
      } else {
        c?.forEach(walk);
      }
    };
    walk(g.coordinates);
    return out;
  }

  function pointSegmentKm(p, a, b) {
    const lat = rad(p[1]);
    const kx = 111.32 * Math.cos(lat);
    const ky = 110.57;
    const px = p[0] * kx, py = p[1] * ky;
    const ax = a[0] * kx, ay = a[1] * ky;
    const bx = b[0] * kx, by = b[1] * ky;
    const dx = bx - ax, dy = by - ay;
    const denom = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / denom));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function nearestLine(p, data) {
    if (!p || !data?.features?.length) return null;
    let best = null;
    for (const f of data.features) {
      for (const [a, b] of segments(f.geometry)) {
        const d = pointSegmentKm(p, a, b);
        if (!best || d < best.distance) {
          best = { distance: d, feature: f };
        }
      }
    }
    return best;
  }

  function centerOfGeometry(g) {
    if (!g) return null;
    const pts = [];
    const walk = x => {
      if (Array.isArray(x) && typeof x[0] === 'number' && typeof x[1] === 'number') {
        pts.push(x);
      } else if (Array.isArray(x)) {
        x.forEach(walk);
      }
    };
    walk(g.coordinates);
    if (!pts.length) return null;
    const sumLon = pts.reduce((s, p) => s + p[0], 0);
    const sumLat = pts.reduce((s, p) => s + p[1], 0);
    return [sumLon / pts.length, sumLat / pts.length];
  }

  function nearbyQuakes(coords, data, radius = 250) {
    if (!coords || !data?.features?.length) return [];
    return data.features
      .map(f => ({ ...f, _distance: haversine(coords, f.geometry.coordinates) }))
      .filter(f => f._distance <= radius)
      .sort((a, b) => (Number(b.properties?.mag) || 0) - (Number(a.properties?.mag) || 0));
  }

  function pointInRing(p, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      const hit = (a[1] > p[1]) !== (b[1] > p[1]) &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1] || 1e-12) + a[0];
      if (hit) inside = !inside;
    }
    return inside;
  }

  function pointInPolygon(p, g) {
    if (!g || !p) return false;
    const poly = rings => rings?.length && pointInRing(p, rings[0]) && !rings.slice(1).some(r => pointInRing(p, r));
    return g.type === 'Polygon'
      ? poly(g.coordinates)
      : g.type === 'MultiPolygon'
      ? g.coordinates.some(poly)
      : false;
  }

  function containingPlate(coords, platePolygonData) {
    if (!coords || !platePolygonData?.features?.length) return null;
    return platePolygonData.features.find(f => pointInPolygon(coords, f.geometry)) || null;
  }

  function plateName(f) {
    if (!f) return null;
    const p = f.properties || {};
    return value(p.Plate_Name, p.PlateName, p.Name, p.NAME, p.Plate_Code, p.Code);
  }

  const STEP_META = {
    SUB: { family: 'subduction', label: 'Subduction zone' },
    OSR: { family: 'divergent', label: 'Oceanic spreading ridge' },
    CRB: { family: 'divergent', label: 'Continental rift boundary' },
    OTF: { family: 'transform', label: 'Oceanic transform fault' },
    CTF: { family: 'transform', label: 'Continental transform fault' },
    OCB: { family: 'convergent', label: 'Oceanic convergent boundary' },
    CCB: { family: 'convergent', label: 'Continental convergent boundary' }
  };

  function boundaryContext(coords, plateStepData) {
    if (!coords || !plateStepData?.features?.length) return null;
    const hit = nearestLine(coords, plateStepData);
    if (!hit) return null;
    const p = hit.feature.properties || {};
    const code = value(p.Boundary_Code, p.STEPCLASS);
    const meta = STEP_META[code] || {
      family: value(p.Boundary_Family, 'other'),
      label: value(p.Boundary_Label, 'Plate boundary')
    };
    return {
      ...hit,
      code,
      family: meta.family,
      label: value(p.Boundary_Label, meta.label),
      pair: value(p.Plate_Pair, p.PLATEBOUND)
    };
  }

  const Geo = {
    esc,
    norm,
    value,
    fmtDate,
    haversine,
    segments,
    pointSegmentKm,
    nearestLine,
    centerOfGeometry,
    nearbyQuakes,
    pointInRing,
    pointInPolygon,
    containingPlate,
    plateName,
    STEP_META,
    boundaryContext
  };

  if (typeof window !== 'undefined') {
    window.OpenEarth = window.OpenEarth || {};
    window.OpenEarth.geo = Geo;
    // Backward compatibility aliases
    window.esc = esc;
    window.norm = norm;
    window.value = value;
    window.fmtDate = fmtDate;
    window.haversine = haversine;
    window.segments = segments;
    window.pointSegmentKm = pointSegmentKm;
    window.nearestLine = nearestLine;
    window.pointInRing = pointInRing;
    window.pointInPolygon = pointInPolygon;
    window.containingPlate = p => containingPlate(p, window.OpenEarth?.data?.platePolygons);
    window.boundaryContext = p => boundaryContext(p, window.OpenEarth?.data?.plateSteps);
    window.plateName = plateName;
    window.STEP_META = STEP_META;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Geo;
  }
})();
