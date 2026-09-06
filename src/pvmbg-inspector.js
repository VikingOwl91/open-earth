/* Add PVMBG regional monitoring to the existing rich volcano drawer without conflating it with GVP. */
(() => {
  let current = null, busy = false;
  const body = document.querySelector('#details-body');
  if (!body) return;

  const escFn = s => typeof esc === 'function' ? esc(s) : String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const factFn = (l, v) => typeof fact === 'function' ? fact(l, v) : (v == null || String(v).trim() === '' ? '' : `<div class="fact"><b>${escFn(l)}</b>${escFn(v)}</div>`);

  function card(s) {
    const age = window.pvmbgSnapshotAge?.();
    return `<section class="drawer-card pvmbg-card" data-pvmbg-card>
      <div class="inspector-heading">Regional monitoring · PVMBG / MAGMA Indonesia</div>
      <div class="meta">
        ${factFn('Activity level', `Level ${s.level} · ${s.label}`)}
        ${age ? factFn('Snapshot', age) : ''}
      </div>
      <p class="semantic-note">Official Indonesian volcano activity level. This regional monitoring status is separate from the GVP weekly report and catalog.</p>
      ${s.reportUrl ? `<a class="drawer-source-link" href="${escFn(s.reportUrl)}" target="_blank" rel="noreferrer">Latest MAGMA report ↗</a>` : ''}
    </section>`;
  }

  function inject() {
    if (busy || !current) return;
    const eyebrow = body.querySelector('.drawer-head .eyebrow')?.textContent || '';
    if (!eyebrow.toLowerCase().includes('volcano')) {
      current = null;
      return;
    }
    busy = true;
    try {
      const s = window.pvmbgForVolcano?.(current);
      if (!s) return;
      const content = body.querySelector('.drawer-content');
      const head = body.querySelector('.drawer-head h2');
      if (!content || !head) return;

      if (!head.querySelector('[data-pvmbg-badge]')) {
        const lvl = (s.level || '').toLowerCase();
        head.insertAdjacentHTML('beforeend', ` <em data-pvmbg-badge class="pvmbg-level-${escFn(lvl)}">PVMBG · ${escFn(s.label.toUpperCase())}</em>`);
      }

      const active = body.querySelector('.drawer-tabs .active')?.dataset.drawerTab;
      if (active === 'overview' && !content.querySelector('[data-pvmbg-card]')) {
        const actCard = content.querySelector('.activity-card');
        const hero = content.querySelector('.poi-hero');
        if (actCard) {
          actCard.insertAdjacentHTML('afterend', card(s));
        } else if (hero) {
          hero.insertAdjacentHTML('afterend', card(s));
        } else {
          content.insertAdjacentHTML('afterbegin', card(s));
        }
      }

      if (active === 'sources' && !content.querySelector('[data-pvmbg-source]')) {
        content.insertAdjacentHTML('beforeend', `<section class="drawer-section" data-pvmbg-source>
          <div class="inspector-heading">Regional monitoring</div>
          <p class="source"><a class="drawer-source-link" href="https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas" target="_blank" rel="noreferrer">PVMBG / MAGMA Indonesia ↗</a></p>
          ${window.pvmbgSnapshotAge?.() ? `<p class="source">PVMBG snapshot: ${escFn(window.pvmbgSnapshotAge())}</p>` : ''}
          <p class="semantic-note">Official volcano hazard monitoring and activity levels are published by the Center for Volcanology and Geological Hazard Mitigation (PVMBG) / MAGMA Indonesia.</p>
        </section>`);
      }
    } finally {
      busy = false;
    }
  }

  const prior = detail;
  detail = function(layer, f) {
    if (layer === 'volcanoes' || layer === 'activity') {
      const incoming = f?.properties || {};
      const cat = typeof volcanoCatalogMatch === 'function' ? volcanoCatalogMatch(incoming) : null;
      current = { ...(cat?.properties || {}), ...incoming };
    } else {
      current = null;
    }
    prior(layer, f);
    queueMicrotask(inject);
  };

  new MutationObserver(() => queueMicrotask(inject)).observe(body, { childList: true, subtree: true });
  window.addEventListener('openearth:pvmbg-ready', inject);
})();

