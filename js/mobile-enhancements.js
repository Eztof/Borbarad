// js/mobile-enhancements.js
// Mobile-spezifische Verbesserungen – Version 2
// - injiziert CSS-Fixes für Tabellen (Sticky-Header, Wrapping, kleinere min-width)
// - umhüllt alle .table mit .table-wrapper + Scroll-Indikator
// - re-applied automatisch bei DOM-Änderungen (Router-Render)

class MobileEnhancements {
  constructor() {
    this.observer = null;
    this.init();
  }

  init() {
    this.addViewportMeta();
    this.injectCssPatch();
    this.handleTouchFeedback();
    this.optimizeModals();
    this.addPullToRefresh();
    this.addScrollToTop();
    this.preventZoom();
    this.handleOrientationChanges();

    // Erste Initialisierung (falls bereits Tabellen im DOM sind)
    this.prepareAllTables();

    // Bei DOM-Änderungen (z. B. Router-Wechsel) erneut anwenden
    this.observeDom();
  }

  /* ---------------- Common helpers ---------------- */

  addViewportMeta() {
    if (!document.querySelector('meta[name="viewport"]')) {
      const viewport = document.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      document.head.appendChild(viewport);
    }
  }

  injectCssPatch() {
    if (document.getElementById('mobile-table-patch')) return;
    const css = `
/* ===== Responsive Tables – Mobile Patch ===== */

/* Wrapper sorgt für horizontales Scrollen und Sticky-Header-Kontext */
@media (max-width: 860px){
  .table-wrapper{
    position: relative;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--panel);
  }
  /* Minimale Breite etwas runter, damit es seltener zu hartem Scrollen kommt */
  .table{
    width: 100%;
    min-width: 520px;
    border-collapse: collapse;
  }
  /* Sticky-Header */
  .table thead th{
    position: sticky;
    top: 0;
    background: var(--panel);
    z-index: 2;
  }
  /* Standard: kein hartes Abschneiden; nur wirklich lange Felder dürfen umbrechen */
  .table th, .table td{
    padding: 12px 8px;
    vertical-align: top;
    white-space: nowrap;
  }
  /* Deine "kleinen" Spalten (Tags, Ort, Verbleib etc.) sollen auf Mobile umbrechen */
  .table td.small{
    white-space: normal;
    word-break: break-word;
  }
  /* Avatare in Tabellen kompakter */
  .table img{
    width: 32px !important;
    height: 32px !important;
    border-radius: 6px;
    object-fit: cover;
  }
  /* Scroll-Hinweis */
  .scroll-indicator{
    position: sticky;
    left: 0;
    top: 0;
    background: linear-gradient(90deg, var(--accent), transparent);
    color: #fff;
    padding: 6px 12px;
    font-size: 12px;
    border-radius: 0 0 8px 0;
    z-index: 3;
    display: none;
    pointer-events: none;
  }
}

/* Sehr kleine Screens: noch etwas enger */
@media (max-width: 480px){
  .table{ min-width: 460px; }
  .table th, .table td{ padding: 8px 6px; }
}
`;
    const style = document.createElement('style');
    style.id = 'mobile-table-patch';
    style.textContent = css;
    document.head.appendChild(style);
  }

  observeDom() {
    const app = document.getElementById('app');
    if (!app) return;

    if (this.observer) this.observer.disconnect();

    this.observer = new MutationObserver((mutations) => {
      let shouldPrepare = false;
      for (const m of mutations) {
        if (m.type === 'childList') {
          // Wenn Tabellen neu dazukommen, erneut vorbereiten
          if ([...m.addedNodes].some(n => this.containsTable(n))) {
            shouldPrepare = true;
            break;
          }
        }
      }
      if (shouldPrepare) this.prepareAllTables();
    });

    this.observer.observe(app, { childList: true, subtree: true });
  }

  containsTable(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.matches && node.matches('.table')) return true;
    return !!node.querySelector?.('.table');
  }

  /* ---------------- Table preparation ---------------- */

  prepareAllTables() {
    const tables = document.querySelectorAll('.table');
    tables.forEach((table) => this.prepareTable(table));
  }

  prepareTable(table) {
    // 1) Wrapper für horizontales Scrollen
    if (!table.parentElement || !table.parentElement.classList.contains('table-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrapper';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }
    const wrapper = table.parentElement;

    // 2) Scroll-Indikator einmalig einfügen
    if (!wrapper.querySelector(':scope > .scroll-indicator')) {
      const indicator = document.createElement('div');
      indicator.className = 'scroll-indicator';
      indicator.textContent = '← → Scrollen';
      wrapper.insertBefore(indicator, table);
      // Initial sichtbar, wenn wirklich horizontal scroll-bar
      setTimeout(() => {
        const scrollable = wrapper.scrollWidth > wrapper.clientWidth;
        indicator.style.display = scrollable ? 'block' : 'none';
        if (scrollable) {
          setTimeout(() => { indicator.style.display = 'none'; }, 2500);
        }
      }, 60);
      wrapper.addEventListener('scroll', () => {
        const atLeft = wrapper.scrollLeft < 24;
        const scrollable = wrapper.scrollWidth > wrapper.clientWidth;
        indicator.style.display = (scrollable && atLeft) ? 'block' : 'none';
      });
    }

    // 3) Maus-Wheel auch horizontal nutzen (Desktop / Tablet mit Touchpad)
    wrapper.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        wrapper.scrollLeft += e.deltaY;
      }
    }, { passive: true });

    // 4) Drag-to-scroll (Touch & Maus gedrückt)
    this.enableDragScroll(wrapper);
  }

  enableDragScroll(wrapper) {
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    const start = (clientX) => {
      isDown = true;
      startX = clientX;
      scrollLeft = wrapper.scrollLeft;
      wrapper.classList.add('dragging');
    };

    const move = (clientX) => {
      if (!isDown) return;
      const dx = clientX - startX;
      wrapper.scrollLeft = scrollLeft - dx;
    };

    const end = () => {
      isDown = false;
      wrapper.classList.remove('dragging');
    };

    // Maus
    wrapper.addEventListener('mousedown', (e) => { if (e.button === 0) start(e.clientX); });
    window.addEventListener('mousemove', (e) => move(e.clientX));
    window.addEventListener('mouseup', end);

    // Touch
    wrapper.addEventListener('touchstart', (e) => { if (e.touches[0]) start(e.touches[0].clientX); }, { passive: true });
    wrapper.addEventListener('touchmove',  (e) => { if (e.touches[0]) move(e.touches[0].clientX); }, { passive: true });
    wrapper.addEventListener('touchend', end);
  }

  /* ---------------- UX niceties (beibehalten / verbessert) ---------------- */

  handleTouchFeedback() {
    document.addEventListener('touchstart', (e) => {
      if (e.target.matches('.btn, .cal-cell, .nsc-row, .obj-row, .diary-row')) {
        e.target.style.transform = 'scale(0.98)';
        e.target.style.opacity = '0.85';
      }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (e.target.matches('.btn, .cal-cell, .nsc-row, .obj-row, .diary-row')) {
        e.target.style.transform = '';
        e.target.style.opacity = '';
      }
    }, { passive: true });
  }

  optimizeModals() {
    // Swipe-to-close für Modals (Bottom-Sheet Feeling)
    let startY = 0;
    document.addEventListener('touchstart', (e) => {
      if (e.target.closest('.modal .panel')) {
        startY = e.touches[0].clientY;
      }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      const panel = e.target.closest?.('.modal .panel');
      if (!panel || !startY) return;
      const y = e.touches[0].clientY;
      const diff = y - startY;
      if (diff > 0) {
        panel.style.transform = `translateY(${Math.min(diff * 0.5, 100)}px)`;
        panel.style.opacity = String(Math.max(1 - (diff / 300), 0.5));
      }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const panel = e.target.closest?.('.modal .panel');
      if (!panel || !startY) return;
      const y = e.changedTouches[0].clientY;
      const diff = y - startY;
      if (diff > 100) {
        const container = panel.closest('.modal');
        if (container) container.innerHTML = '';
      } else {
        panel.style.transform = '';
        panel.style.opacity = '';
      }
      startY = 0;
    });
  }

  addPullToRefresh() {
    if (!('serviceWorker' in navigator)) return;

    let startY = 0;
    let pulling = false;
    const bar = document.createElement('div');
    bar.className = 'pull-to-refresh';
    bar.textContent = '⟳ Ziehen zum Aktualisieren';
    Object.assign(bar.style, {
      position: 'fixed', top: '-60px', left: '0', right: '0', height: '60px',
      background: 'var(--accent)', color: '#fff', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontSize: '14px',
      transition: 'transform .2s ease', zIndex: '1001'
    });
    document.body.appendChild(bar);

    const setY = (px) => { bar.style.transform = `translateY(${px}px)`; };

    document.addEventListener('touchstart', (e) => {
      if (window.scrollY === 0) { startY = e.touches[0].clientY; pulling = true; }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!pulling) return;
      const dy = Math.max(0, e.touches[0].clientY - startY);
      setY(Math.min(60, dy));
    }, { passive: true });

    document.addEventListener('touchend', async () => {
      if (!pulling) return;
      pulling = false;
      setY(0);
      try {
        // Hard reload via SW cache-bypass
        location.reload();
      } catch {}
    });
  }

  addScrollToTop() {
    const btn = document.createElement('button');
    btn.className = 'scroll-top';
    btn.setAttribute('aria-label', 'Nach oben');
    btn.textContent = '↑';
    document.body.appendChild(btn);

    const toggle = () => { btn.style.display = window.scrollY > 320 ? 'block' : 'none'; };
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();

    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  handleOrientationChanges() {
    window.addEventListener('orientationchange', () => {
      // Nach Drehung Layout kurz neu „anticken“, damit Sticky/Wrapper korrekt rechnen
      setTimeout(() => this.prepareAllTables(), 150);
    });
  }

  preventZoom() {
    // Doppeltipp-/Pinch-Zoom unterbinden (iOS)
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }
}

new MobileEnhancements();
export default MobileEnhancements;
