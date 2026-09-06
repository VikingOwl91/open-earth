/**
 * Open Earth - Public Information & Legal Modals
 * Lightweight, accessible About, Legal Notice and Privacy dialogs.
 */
(() => {
  'use strict';

  class ModalController {
    constructor() {
      this.activeModal = null;
      this._createModalContainer();
      this._bindEscKey();
    }

    _createModalContainer() {
      if (document.getElementById('open-earth-modal-overlay')) return;
      const overlay = document.createElement('div');
      overlay.id = 'open-earth-modal-overlay';
      overlay.className = 'modal-overlay';
      overlay.hidden = true;
      overlay.innerHTML = `
        <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button class="modal-close-btn" id="modal-close" type="button" aria-label="Close dialog">×</button>
          <div class="modal-body" id="modal-content"></div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });
      overlay.querySelector('#modal-close').onclick = () => this.close();
    }

    _bindEscKey() {
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.activeModal) this.close();
      });
    }

    open(type) {
      const overlay = document.getElementById('open-earth-modal-overlay');
      const content = document.getElementById('modal-content');
      if (!overlay || !content) return;
      this.activeModal = type;
      if (type === 'about') content.innerHTML = this._getAboutHtml();
      else if (type === 'imprint') content.innerHTML = this._getImprintHtml();
      else if (type === 'privacy') content.innerHTML = this._getPrivacyHtml();
      overlay.hidden = false;
      overlay.classList.add('visible');
      overlay.querySelector('#modal-close')?.focus();
    }

    close() {
      const overlay = document.getElementById('open-earth-modal-overlay');
      if (overlay) {
        overlay.classList.remove('visible');
        overlay.hidden = true;
      }
      this.activeModal = null;
    }

    _getAboutHtml() {
      return `
        <h2 id="modal-title" class="modal-header-title">About Open Earth</h2>
        <p class="modal-tagline">A modern open-source map for understanding what the Earth is doing — and why.</p>
        <div class="modal-principle-box"><strong>Core Principle</strong><p>“Every displayed fact knows where it came from and how old it is.”</p></div>
        <section class="modal-section">
          <h3>Open Source & Public Architecture</h3>
          <p>Open Earth is built on public geoscience datasets, modern vector mapping (MapLibre GL), and transparent data provenance. It runs entirely as a static web application without accounts, user databases, tracking analytics, cookies, or server-side telemetry.</p>
          <div class="modal-link-grid">
            <a class="modal-action-link" href="https://github.com/VikingOwl91/open-earth" target="_blank" rel="noreferrer"><span>⌥</span> GitHub Repository</a>
            <a class="modal-action-link" href="https://github.com/VikingOwl91/open-earth/blob/main/LICENSE" target="_blank" rel="noreferrer"><span>⚖</span> MIT License</a>
            <a class="modal-action-link" href="https://ko-fi.com/Y4N626HMX7" target="_blank" rel="noreferrer"><span>♡</span> Support the Project</a>
          </div>
        </section>
        <section class="modal-section">
          <h3>Scientific Classification Philosophy</h3>
          <p>To avoid false geological conclusions, Open Earth strictly separates:</p>
          <ul>
            <li><strong>Reference Geology:</strong> Authoritative catalog facts (Smithsonian GVP, Peter Bird PB2002, GEM Faults).</li>
            <li><strong>Observed Activity:</strong> Live events and official alerts from responsible regional agencies (USGS, PVMBG, JMA, GeoNet).</li>
            <li><strong>Derived Calculations:</strong> Spatial proximity metrics, clearly marked so that proximity is never mistaken for causation.</li>
          </ul>
        </section>`;
    }

    _getImprintHtml() {
      return `
        <h2 id="modal-title" class="modal-header-title">Impressum / Legal Notice</h2>
        <p class="modal-tagline">Provider information pursuant to § 5 German Digital Services Act (DDG).</p>
        <section class="modal-section">
          <h3>Provider / Responsible Operator</h3>
          <p>Open Earth is a non-commercial, open-source science and education project.</p>
          <div class="legal-placeholder-card">
            <strong>Christian Nachtigall</strong><br/>
            Karwendelstr. 21<br/>
            82061 Neuried<br/>
            Germany<br/>
            <a href="mailto:contact@nachtigall.dev">contact@nachtigall.dev</a>
          </div>
        </section>
        <section class="modal-section">
          <h3>Disclaimer</h3>
          <p><strong>Content:</strong> Data and visualizations are based on publicly available sources from scientific institutions including USGS, Smithsonian Institution, GEBCO, PB2002, GEM Foundation, PVMBG, JMA and GeoNet. No guarantee is made as to completeness, accuracy or timeliness.</p>
          <p><strong>No safety or navigation function:</strong> Open Earth is provided for educational and research purposes. It is expressly <em>not</em> intended for navigation, aviation, maritime use, emergency warnings, evacuation decisions or other safety-critical decisions. Always consult the responsible official authorities.</p>
        </section>`;
    }

    _getPrivacyHtml() {
      return `
        <h2 id="modal-title" class="modal-header-title">Privacy</h2>
        <p class="modal-tagline">Transparent information about local storage and browser network requests.</p>
        <div class="modal-principle-box"><strong>Open Earth does not track you.</strong><p>No tracking services, advertising networks, user profiles or cookies.</p></div>
        <section class="modal-section">
          <h3>1. No cookies or tracking</h3>
          <p>Open Earth does not set functional or advertising cookies and does not use analytics, advertising or fingerprinting. The application therefore does not use a cookie consent banner.</p>
        </section>
        <section class="modal-section">
          <h3>2. Local storage</h3>
          <p>Your browser stores technical display preferences locally on your device, such as the selected base map, projection, enabled layers and last map position. These preferences are not transmitted by Open Earth to an application backend.</p>
        </section>
        <section class="modal-section">
          <h3>3. Direct browser connections</h3>
          <p>To render maps and retrieve live or requested information, your browser may connect directly to third-party infrastructure. Those providers receive the technical information normally required for an HTTP request, such as your IP address.</p>
          <ul class="privacy-endpoint-list">
            <li><strong>OpenFreeMap:</strong> vector tiles and map assets (<code>tiles.openfreemap.org</code>).</li>
            <li><strong>USGS Earthquake Hazards Program:</strong> live and historical earthquake data (<code>earthquake.usgs.gov</code>).</li>
            <li><strong>GEBCO Bathymetry:</strong> seafloor relief when the optional relief layer is enabled (<code>wms.gebco.net</code>).</li>
            <li><strong>OpenStreetMap Nominatim:</strong> geocoding when you submit text in the search field (<code>nominatim.openstreetmap.org</code>).</li>
            <li><strong>Wikipedia / Wikimedia:</strong> volcano preview images when an inspector requests them (<code>en.wikipedia.org</code> and Wikimedia infrastructure).</li>
            <li><strong>unpkg:</strong> MapLibre GL library assets loaded by the application (<code>unpkg.com</code>).</li>
          </ul>
          <p class="semantic-note">Reference geology datasets such as volcanoes, plate boundaries, trenches and faults are served as static files from the Open Earth deployment. Detailed source provenance is documented in the project repository.</p>
        </section>
        <section class="modal-section">
          <h3>4. Controller and privacy contact</h3>
          <p>Responsible for this website: Christian Nachtigall, Karwendelstr. 21, 82061 Neuried, Germany. Privacy questions: <a href="mailto:contact@nachtigall.dev">contact@nachtigall.dev</a>.</p>
        </section>`;
    }
  }

  const Modals = { ModalController };
  if (typeof window !== 'undefined') {
    window.OpenEarth = window.OpenEarth || {};
    window.OpenEarth.modalController = new ModalController();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = Modals;
})();
