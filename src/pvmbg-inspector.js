/* Multi-provider regional volcano monitoring presentation.
 * Supports PVMBG (Indonesia), USGS (United States), JMA (Japan), and GeoNet (New Zealand)
 * without conflating official regional alert levels with GVP weekly reports.
 */
(() => {
  let current = null, busy = false;
  const body = document.querySelector('#details-body');
  if (!body) return;

  const escFn = s => typeof esc === 'function' ? esc(s) : String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function reportLinkTitle(providerId) {
    if (providerId === 'pvmbg') return 'Latest MAGMA report ↗';
    if (providerId === 'usgs') return 'Official USGS notice ↗';
    if (providerId === 'jma') return 'Official JMA details ↗';
    if (providerId === 'geonet') return 'Official GeoNet bulletin ↗';
    return 'Official agency report ↗';
  }

  function card(r) {
    const age = r.snapshotAge;
    const sev = (r.severity || 'normal').toLowerCase();
    const lvl = (r.level || '').toLowerCase();
    const provMeta = [r.providerName, age].filter(Boolean).join(' · ');
    const statusLabel = escFn(r.label.toUpperCase());
    const linkText = reportLinkTitle(r.providerId);

    return `<section class="drawer-card regional-card pvmbg-card" data-regional-card="${escFn(r.providerId)}" data-pvmbg-card>
      <div class="regional-header pvmbg-header">
        <span class="inspector-heading">Regional status</span>
        <span class="regional-provider-meta pvmbg-provider-meta">${escFn(provMeta)}</span>
      </div>
      <div class="regional-status-row pvmbg-status-row">
        <span class="regional-badge pvmbg-badge regional-severity-${escFn(sev)} pvmbg-level-${escFn(lvl)}">${statusLabel}</span>
        ${r.reportUrl ? `<a class="regional-report-link pvmbg-report-link" href="${escFn(r.reportUrl)}" target="_blank" rel="noreferrer">${escFn(linkText)}</a>` : ''}
      </div>
      ${r.note ? `<p class="regional-note pvmbg-note">${escFn(r.note)}</p>` : ''}
    </section>`;
  }

  function sourceSection(r) {
    return `<section class="drawer-section" data-regional-source="${escFn(r.providerId)}" data-pvmbg-source>
      <div class="inspector-heading">Regional monitoring · ${escFn(r.providerName)}</div>
      <p class="source"><a class="drawer-source-link" href="${escFn(r.sourceUrl)}" target="_blank" rel="noreferrer">${escFn(r.providerName)} ↗</a></p>
      ${r.snapshotAge ? `<p class="source">${escFn(r.providerName)} snapshot: ${escFn(r.snapshotAge)}</p>` : ''}
      <p class="semantic-note">${escFn(r.provenance)}</p>
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
      const records = typeof window.regionalMonitoringForVolcano === 'function'
        ? window.regionalMonitoringForVolcano(current)
        : (window.pvmbgForVolcano?.(current) ? [window.pvmbgForVolcano(current)] : []);

      if (!records.length) return;

      const content = body.querySelector('.drawer-content');
      const head = body.querySelector('.drawer-head h2');
      if (!content || !head) return;

      // Add badge(s) to drawer title
      for (const r of records) {
        if (!head.querySelector(`[data-regional-badge="${r.providerId}"]`)) {
          const sev = (r.severity || 'normal').toLowerCase();
          const lvl = (r.level || '').toLowerCase();
          const badgeLabel = escFn(r.label.toUpperCase());
          head.insertAdjacentHTML('beforeend', ` <em data-regional-badge="${escFn(r.providerId)}" data-pvmbg-badge class="regional-badge regional-severity-${escFn(sev)} pvmbg-level-${escFn(lvl)}">${badgeLabel}</em>`);
        }
      }

      const active = body.querySelector('.drawer-tabs .active')?.dataset.drawerTab;
      if (active === 'overview') {
        const existingCards = content.querySelectorAll('[data-regional-card]');
        if (!existingCards.length) {
          const actCard = content.querySelector('.activity-card');
          const hero = content.querySelector('.poi-hero');
          const insertAnchor = actCard || hero;
          for (let i = records.length - 1; i >= 0; i--) {
            const html = card(records[i]);
            if (insertAnchor) {
              insertAnchor.insertAdjacentHTML('afterend', html);
            } else {
              content.insertAdjacentHTML('afterbegin', html);
            }
          }
        }
      }

      if (active === 'sources') {
        for (const r of records) {
          if (!content.querySelector(`[data-regional-source="${r.providerId}"]`)) {
            content.insertAdjacentHTML('beforeend', sourceSection(r));
          }
        }
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
  window.addEventListener('openearth:regional-monitoring-ready', inject);
  window.addEventListener('openearth:pvmbg-ready', inject);
})();
