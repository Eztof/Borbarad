// Mobile-specific enhancements for Borbarad DSA Tool
// Zu integrieren in eine neue Datei: js/mobile-enhancements.js

class MobileEnhancements {
  constructor() {
    this.init();
  }

  init() {
    this.addViewportMeta();
    this.handleTouchEvents();
    this.improveTableScrolling();
    // this.addPullToRefresh(); Entfernt: Pull-to-Refresh Funktionalität
    this.optimizeModals();
    this.addScrollToTop();
    this.handleOrientationChanges();
    this.preventZoom();
  }

  // Viewport Meta-Tag hinzufügen falls nicht vorhanden
  addViewportMeta() {
    if (!document.querySelector('meta[name="viewport"]')) {
      const viewport = document.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.head.appendChild(viewport);
    }
  }

  // Touch-Events für bessere mobile Interaktion
  handleTouchEvents() {
    // Touch-Feedback für Buttons
    document.addEventListener('touchstart', (e) => {
      if (e.target.matches('.btn, .cal-cell, .nsc-row, .obj-row')) {
        e.target.style.transform = 'scale(0.98)';
        e.target.style.opacity = '0.8';
      }
    });

    document.addEventListener('touchend', (e) => {
      if (e.target.matches('.btn, .cal-cell, .nsc-row, .obj-row')) {
        e.target.style.transform = '';
        e.target.style.opacity = '';
      }
    });

    // Swipe-to-close für Modals
    let startY = 0;
    document.addEventListener('touchstart', (e) => {
      if (e.target.closest('.modal .panel')) {
        startY = e.touches[0].clientY;
      }
    });

    document.addEventListener('touchmove', (e) => {
      const modal = e.target.closest('.modal .panel');
      if (modal && startY) {
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        
        if (diff > 0) { // Nach unten wischen
          modal.style.transform = `translateY(${Math.min(diff * 0.5, 100)}px)`;
          modal.style.opacity = Math.max(1 - (diff / 300), 0.5);
        }
      }
    });

    document.addEventListener('touchend', (e) => {
      const modal = e.target.closest('.modal .panel');
      if (modal && startY) {
        const currentY = e.changedTouches[0].clientY;
        const diff = currentY - startY;
        
        if (diff > 100) { // Modal schließen wenn weit genug gewischt
          const modalContainer = modal.closest('.modal');
          if (modalContainer) {
            modalContainer.innerHTML = '';
          }
        } else {
          // Zurück zur ursprünglichen Position
          modal.style.transform = '';
          modal.style.opacity = '';
        }
        startY = 0;
      }
    });
  }

  // Verbesserte Tabellen-Navigation auf Mobile
  improveTableScrolling() {
    const tables = document.querySelectorAll('.table');
    tables.forEach(table => {
      // Wrapper für horizontales Scrollen hinzufügen
      if (!table.parentElement.classList.contains('table-wrapper')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'table-wrapper';
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      }

      // Scroll-Indikatoren
      const wrapper = table.parentElement;
      const scrollIndicator = document.createElement('div');
      scrollIndicator.className = 'scroll-indicator';
      scrollIndicator.innerHTML = '← → Scrollen';
      scrollIndicator.style.cssText = `
        position: sticky;
        left: 0;
        background: var(--accent);
        color: white;
        padding: 4px 8px;
        font-size: 12px;
        text-align: center;
        border-radius: 0 0 8px 8px;
        display: none;
      `;
      
      wrapper.insertBefore(scrollIndicator, table);

      // Scroll-Indikator ein/ausblenden
      wrapper.addEventListener('scroll', () => {
        const isScrollable = wrapper.scrollWidth > wrapper.clientWidth;
        scrollIndicator.style.display = isScrollable && wrapper.scrollLeft < 50 ? 'block' : 'none';
      });

      // Initial check
      setTimeout(() => {
        const isScrollable = wrapper.scrollWidth > wrapper.clientWidth;
        if (isScrollable) {
          scrollIndicator.style.display = 'block';
          setTimeout(() => {
            scrollIndicator.style.display = 'none';
          }, 3000);
        }
      }, 100);
    });
  }

  // Pull-to-Refresh Funktionalität
  addPullToRefresh() {
  // Pull-to-Refresh wurde entfernt.
  // Diese Funktion ist jetzt absichtlich leer.
  console.log('Pull-to-Refresh ist deaktiviert.');
  // Der ursprüngliche Code für Pull-to-Refresh ist auskommentiert oder gelöscht.
}

  // Modal-Verbesserungen für Mobile
  optimizeModals() {
    // Observer für neue Modals
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.classList.contains('modal')) {
            this.enhanceModal(node);
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Bestehende Modals enhancen
    document.querySelectorAll('.modal').forEach(modal => {
      this.enhanceModal(modal);
    });
  }

  enhanceModal(modal) {
    const panel = modal.querySelector('.panel');
    if (!panel) return;

    // Fokus-Management
    const focusableElements = panel.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    // Escape-Taste zum Schließen
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        modal.innerHTML = '';
        document.removeEventListener('keydown', handleEscape);
      }
    };
    
    document.addEventListener('keydown', handleEscape);

    // Fokus innerhalb Modal halten
    const trapFocus = (e) => {
      if (e.key === 'Tab') {
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };
    
    modal.addEventListener('keydown', trapFocus);
  }

  // Scroll-to-Top Button
  addScrollToTop() {
    const scrollButton = document.createElement('button');
    scrollButton.className = 'scroll-top';
    scrollButton.innerHTML = '↑';
    scrollButton.style.display = 'none';
    scrollButton.setAttribute('aria-label', 'Nach oben scrollen');
    
    document.body.appendChild(scrollButton);

    scrollButton.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        scrollButton.style.display = 'flex';
      } else {
        scrollButton.style.display = 'none';
      }
    });
  }

  // Orientierungsänderungen handhaben
  handleOrientationChanges() {
    window.addEventListener('orientationchange', () => {
      // Fix für iOS Safari viewport bug
      setTimeout(() => {
        document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
      }, 500);
    });

    // Initial setzen
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
  }

  // Zoom verhindern bei Eingabe-Fokus (iOS Safari)
  preventZoom() {
    const inputs = document.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      input.addEventListener('focus', (e) => {
        if (e.target.style.fontSize !== '16px') {
          e.target.style.fontSize = '16px';
        }
      });
      
      input.addEventListener('blur', (e) => {
        e.target.style.fontSize = '';
      });
    });
  }

  // Utility: Stacked Table für sehr kleine Screens erstellen
  createStackedTable(table) {
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent);
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    
    const stackedContainer = document.createElement('div');
    stackedContainer.className = 'table-stacked';
    
    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      const item = document.createElement('div');
      item.className = 'item';
      
      const header = document.createElement('div');
      header.className = 'item-header';
      header.textContent = cells[0]?.textContent || 'Item';
      item.appendChild(header);
      
      cells.forEach((cell, index) => {
        if (index === 0) return; // Skip first cell (used as header)
        
        const itemRow = document.createElement('div');
        itemRow.className = 'item-row';
        
        const label = document.createElement('span');
        label.className = 'item-label';
        label.textContent = headers[index] || `Feld ${index}`;
        
        const value = document.createElement('span');
        value.innerHTML = cell.innerHTML;
        
        itemRow.appendChild(label);
        itemRow.appendChild(value);
        item.appendChild(itemRow);
      });
      
      stackedContainer.appendChild(item);
    });
    
    return stackedContainer;
  }

  // Performance-Monitoring für Mobile
  monitorPerformance() {
    if ('performance' in window) {
      window.addEventListener('load', () => {
        const navigation = performance.getEntriesByType('navigation')[0];
        
        // Warnung bei langsamer Ladezeit
        if (navigation.loadEventEnd > 3000) {
          console.warn('Slow page load detected:', navigation.loadEventEnd + 'ms');
          
          // Optional: Feedback an den Benutzer
          if (window.innerWidth <= 768) {
            const notice = document.createElement('div');
            notice.style.cssText = `
              position: fixed;
              bottom: 20px;
              left: 20px;
              right: 20px;
              background: var(--accent);
              color: white;
              padding: 12px;
              border-radius: 8px;
              font-size: 14px;
              z-index: 1000;
            `;
            notice.textContent = 'Langsame Verbindung erkannt. Einige Funktionen können verzögert laden.';
            document.body.appendChild(notice);
            
            setTimeout(() => {
              notice.remove();
            }, 5000);
          }
        }
      });
    }
  }
}

// Service Worker für Offline-Funktionalität
function registerServiceWorker() {
  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registered');
        
        // Update verfügbar
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Benutzer über Update informieren
              const updateNotice = document.createElement('div');
              updateNotice.style.cssText = `
                position: fixed;
                top: 20px;
                left: 20px;
                right: 20px;
                background: var(--good);
                color: white;
                padding: 12px;
                border-radius: 8px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                z-index: 1001;
              `;
              
              updateNotice.innerHTML = `
                <span>Update verfügbar!</span>
                <button onclick="window.location.reload()" style="background:transparent;border:1px solid white;color:white;padding:4px 8px;border-radius:4px;cursor:pointer;">
                  Aktualisieren
                </button>
              `;
              
              document.body.appendChild(updateNotice);
            }
          });
        });
      })
      .catch(err => {
        console.log('ServiceWorker registration failed');
      });
  }
}

// Initialisierung
document.addEventListener('DOMContentLoaded', () => {
  new MobileEnhancements();
  registerServiceWorker();
});

// Export für Module
export { MobileEnhancements };