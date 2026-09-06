/**
 * Open Earth - Public Information & Legal Modals
 * Renders lightweight, accessible modals for:
 * - About Open Earth (Principle, Open Source, MIT License)
 * - Impressum (German legal notice under § 5 DDG with required maintainer placeholders)
 * - Datenschutz / Privacy (Audited network behavior, no cookies, no tracking)
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
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.addEventListener('click', e => {
        if (e.target === overlay) this.close();
      });

      overlay.querySelector('#modal-close').onclick = () => this.close();
    }

    _bindEscKey() {
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.activeModal) {
          this.close();
        }
      });
    }

    open(type) {
      const overlay = document.getElementById('open-earth-modal-overlay');
      const content = document.getElementById('modal-content');
      if (!overlay || !content) return;

      this.activeModal = type;

      if (type === 'about') {
        content.innerHTML = this._getAboutHtml();
      } else if (type === 'imprint') {
        content.innerHTML = this._getImprintHtml();
      } else if (type === 'privacy') {
        content.innerHTML = this._getPrivacyHtml();
      }

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

        <div class="modal-principle-box">
          <strong>Core Principle</strong>
          <p>“Every displayed fact knows where it came from and how old it is.”</p>
        </div>

        <section class="modal-section">
          <h3>Open Source & Public Architecture</h3>
          <p>Open Earth is built on public geoscience datasets, modern vector mapping (MapLibre GL), and transparent data provenance. It runs entirely as a static web application without accounts, user databases, tracking analytics, cookies, or server-side telemetry.</p>
          <div class="modal-link-grid">
            <a class="modal-action-link" href="https://github.com/VikingOwl91/open-earth" target="_blank" rel="noreferrer">
              <span>⌥</span> GitHub Repository
            </a>
            <a class="modal-action-link" href="https://github.com/VikingOwl91/open-earth/blob/main/LICENSE" target="_blank" rel="noreferrer">
              <span>⚖</span> MIT License
            </a>
            <a class="modal-action-link" href="https://ko-fi.com/Y4N626HMX7" target="_blank" rel="noreferrer">
              <span>♡</span> Support the Project
            </a>
          </div>
        </section>

        <section class="modal-section">
          <h3>Scientific Classification Philosophy</h3>
          <p>To avoid false geological conclusions, Open Earth strictly separates:</p>
          <ul>
            <li><strong>Reference Geology:</strong> Authoritative peer-reviewed catalog facts (Smithsonian GVP, Peter Bird PB2002, GEM Faults).</li>
            <li><strong>Observed Activity:</strong> Live events and official alerts from responsible regional agencies (USGS, PVMBG, JMA, GeoNet).</li>
            <li><strong>Derived Calculations:</strong> Spatial proximity metrics (distance to nearest trench or boundary), clearly marked so that proximity is never mistaken for causation.</li>
          </ul>
        </section>
      `;
    }

    _getImprintHtml() {
      return `
        <h2 id="modal-title" class="modal-header-title">Impressum / Legal Notice</h2>
        <p class="modal-tagline">Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)</p>

        <section class="modal-section">
          <h3>Diensteanbieter / Betreiber</h3>
          <p>Open Earth ist ein nichtkommerzielles, quelloffenes Wissenschafts- und Bildungsprojekt.</p>
          <div class="legal-placeholder-card">
            <strong>Verantwortlicher Betreiber:</strong><br/>
            [FULL LEGAL NAME]<br/>
            [SERVICEABLE POSTAL ADDRESS]<br/>
            [CONTACT EMAIL]
          </div>
          <p class="semantic-note">Hinweis für Maintainer: Vor der Veröffentlichung müssen die obenstehenden Platzhalter durch die ladungsfähige Anschrift und Kontaktdaten des Betreibers ersetzt werden.</p>
        </section>

        <section class="modal-section">
          <h3>Haftungsausschluss (Disclaimer)</h3>
          <p><strong>Inhalte des Onlineangebotes:</strong> Alle dargestellten Daten und Visualisierungen basieren auf öffentlich zugänglichen Datenquellen wissenschaftlicher Institute (u. a. USGS, Smithsonian Institution, GEBCO, PB2002, GEM Foundation, PVMBG, JMA, GeoNet). Die Daten werden ohne Gewähr auf Vollständigkeit, Richtigkeit oder Aktualität bereitgestellt.</p>
          <p><strong>Keine Sicherheits- oder Navigationsfunktion:</strong> Die Visualisierungen auf Open Earth dienen ausschließlich Bildungs- und Forschungszwecken. Sie sind ausdrücklich <em>nicht</em> für die Navigation, Schifffahrt, Luftfahrt oder für behördliche Evakuierungs- und Katastrophenschutzentscheidungen bestimmt.</p>
        </section>
      `;
    }

    _getPrivacyHtml() {
      return `
        <h2 id="modal-title" class="modal-header-title">Datenschutz / Privacy</h2>
        <p class="modal-tagline">Transparenz über Datenverarbeitung und Netzwerkanfragen.</p>

        <div class="modal-principle-box">
          <strong>Open Earth verfolgt Sie nicht.</strong>
          <p>Keine Tracking-Dienste, keine Werbenetzwerke, keine Nutzerprofile, keine Cookies.</p>
        </div>

        <section class="modal-section">
          <h3>1. Keine Cookies & kein Tracking</h3>
          <p>Open Earth setzt weder funktionale noch werbliche Cookies. Aus diesem Grund existiert und benötigt diese Anwendung kein Cookie-Banner.</p>
        </section>

        <section class="modal-section">
          <h3>2. Lokale Speicherung (localStorage)</h3>
          <p>Ihr Browser speichert ausschließlich technische Darstellungseinstellungen lokal auf Ihrem Endgerät (z. B. gewählte Basiskarte, Projektion, aktivierte Ebenen und letzte Kartenkoordinaten). Diese Einstellungen werden niemals an unsere Server übertragen.</p>
        </section>

        <section class="modal-section">
          <h3>3. Direkte Browser-Netzwerkverbindungen</h3>
          <p>Zur Darstellung der Karte und Bereitstellung von Echtzeitdaten sendet Ihr Browser direkte HTTP-Anfragen an folgende vertrauenswürdige wissenschaftliche und freie Infrastrukturen:</p>
          <ul class="privacy-endpoint-list">
            <li><strong>OpenFreeMap / MapLibre:</strong> Vektorkacheln und Schriften für die Kartenbasiskarte (<code>tiles.openfreemap.org</code>).</li>
            <li><strong>USGS Earthquake Hazards Program:</strong> Live-Erdbebendaten (<code>earthquake.usgs.gov</code>).</li>
            <li><strong>GEBCO Bathymetry (WMS):</strong> Relief-Topografie bei optional aktivierter Relief-Ebene (<code>wms.gebco.net</code>).</li>
            <li><strong>OpenStreetMap Nominatim:</strong> Geokodierung bei Texteingabe in das Suchfeld (<code>nominatim.openstreetmap.org</code>).</li>
            <li><strong>Wikipedia / Wikimedia:</strong> Vorschaubilder im Vulkan-Inspektor (<code>en.wikipedia.org</code>).</li>
          </ul>
          <p class="semantic-note">Referenzgeologische Datensätze (Vulkane, Plattengrenzen, Gräben, Verwerfungen) werden statisch aus diesem Repository (<code>data/*.json</code>) bereitgestellt.</p>
        </section>

        <section class="modal-section">
          <h3>4. Kontakt bei Datenschutzfragen</h3>
          <p>Bei Fragen zum Datenschutz wenden Sie sich bitte an: <code>[CONTACT EMAIL]</code>.</p>
        </section>
      `;
    }
  }

  const Modals = {
    ModalController
  };

  if (typeof window !== 'undefined') {
    window.OpenEarth = window.OpenEarth || {};
    window.OpenEarth.modalController = new ModalController();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Modals;
  }
})();
