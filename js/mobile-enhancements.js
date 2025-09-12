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
        this.optimizeModals(); // Diese Methode bleibt, aber ruft enhanceModal nicht mehr auf
        this.addScrollToTop();
        this.handleOrientationChanges();
        this.preventZoom();
        this.detectSlowLoad();
        this.registerServiceWorker();
    }

    // Viewport Meta-Tag hinzufügen falls nicht vorhanden
    addViewportMeta() {
        if (!document.querySelector('meta[name="viewport"]')) {
            const viewport = document.createElement('meta');
            viewport.name = 'viewport';
            viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
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

        // Zoom-Verhinderung bei Input-Focus
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
        stackedContainer.className = 'stacked-table-container';

        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            const stackedRow = document.createElement('div');
            stackedRow.className = 'stacked-row';
            
            cells.forEach((cell, index) => {
                if (headers[index]) {
                    const label = document.createElement('div');
                    label.className = 'stacked-label';
                    label.textContent = headers[index];
                    const value = document.createElement('div');
                    value.className = 'stacked-value';
                    value.innerHTML = cell.innerHTML;
                    stackedRow.appendChild(label);
                    stackedRow.appendChild(value);
                }
            });
            
            stackedContainer.appendChild(stackedRow);
        });

        table.parentNode.replaceChild(stackedContainer, table);
    }

    // Verbesserte Tabellen-Navigation auf Mobile
    improveTableScrolling() {
        const tables = document.querySelectorAll('.table');
        tables.forEach(table => {
            // Horizontales Scrollen auf Mobile verbessern
            table.style.overflowX = 'auto';
            table.style.webkitOverflowScrolling = 'touch';
            
            // Zeilen-Highlighting bei Touch
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                row.addEventListener('touchstart', () => {
                    row.classList.add('touch-active');
                });
                row.addEventListener('touchend', () => {
                    setTimeout(() => row.classList.remove('touch-active'), 150);
                });
            });
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
                        // *** ÄNDERUNG: enhanceModal wird NICHT aufgerufen ***
                        // this.enhanceModal(node);
                        // *** Dadurch wird das Swipe-to-Close deaktiviert ***
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Bestehende Modals enhance
        document.querySelectorAll('.modal').forEach(modal => {
             // *** ÄNDERUNG: enhanceModal wird NICHT aufgerufen ***
            // this.enhanceModal(modal);
             // *** Dadurch wird das Swipe-to-Close deaktiviert ***
        });
    }

    // Enhance Modal für bessere Mobile UX - OHNE SWIPE ZU SCHLIESSEN
    // *** Diese Methode bleibt im Code, wird aber nicht mehr aufgerufen ***
    enhanceModal(modal) {
        const panel = modal.querySelector('.panel');
        if (!panel) return;

        // Fokus-Management
        const focusableElements = panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }

        // Escape-Taste zum Schließen
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.innerHTML = '';
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Touch-Events für visuelles Feedback (OHNE Swipe-to-Close)
        let startY = 0;

        panel.addEventListener('touchstart', (e) => {
            startY = e.changedTouches[0].clientY;
        }, { passive: true });

        panel.addEventListener('touchmove', (e) => {
            const currentY = e.changedTouches[0].clientY;
            const diff = currentY - startY;
            if (diff > 0) { // Nur nach unten ziehen erlauben für visuelles Feedback
                panel.style.transform = `translateY(${diff}px)`;
                panel.style.opacity = Math.max(1 - (diff / 300), 0.5);
            }
        }, { passive: true });

        panel.addEventListener('touchend', (e) => {
            // Zurück zur ursprünglichen Position (OHNE Schließen)
            panel.style.transform = '';
            panel.style.opacity = '';
            startY = 0;
        });

        // Cleanup
        modal.addEventListener('DOMNodeRemoved', () => {
            document.removeEventListener('keydown', handleEscape);
        });
    }
    // *** Ende der nicht aufgerufenen Methode ***

    // "Nach oben" Button für lange Listen
    addScrollToTop() {
        // Button erstellen
        const scrollToTopBtn = document.createElement('button');
        scrollToTopBtn.innerHTML = '↑';
        scrollToTopBtn.className = 'scroll-to-top';
        scrollToTopBtn.setAttribute('aria-label', 'Nach oben scrollen');
        scrollToTopBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: var(--accent);
            color: white;
            border: none;
            font-size: 18px;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            z-index: 1000;
            display: none;
            justify-content: center;
            align-items: center;
        `;
        document.body.appendChild(scrollToTopBtn);

        // Scroll-Verhalten
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                scrollToTopBtn.style.display = 'flex';
            } else {
                scrollToTopBtn.style.display = 'none';
            }
        });

        // Klick-Event
        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Orientierungswechsel handhaben
    handleOrientationChanges() {
        window.addEventListener('orientationchange', () => {
            // Timeout, weil der Wechsel asynchron ist
            setTimeout(() => {
                // Ggf. Layout-Anpassungen
                console.log('Orientierung gewechselt zu:', window.orientation);
            }, 300);
        });
    }

    // Zooming verhindern
    preventZoom() {
        // Doppelklick-Zoom verhindern
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);

        // Pinch-Zoom verhindern
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    // Langsame Ladezeiten erkennen
    detectSlowLoad() {
        window.addEventListener('load', () => {
            // Navigation Timing API verwenden
            const navigation = performance.getEntriesByType('navigation')[0];
            if (navigation && navigation.loadEventEnd > 3000) { // Länger als 3 Sekunden
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

     // Service Worker für Offline-Funktionalität
     registerServiceWorker() {
        if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
            navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registered');
                
                // Update-Benachrichtigung
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Update verfügbar
                            const updateNotice = document.createElement('div');
                            updateNotice.style.cssText = `
                                position: fixed;
                                bottom: 20px;
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
                            updateNotice.innerHTML = `<span>Update verfügbar!</span><button onclick="window.location.reload()" style="background:transparent;border:1px solid white;color:white;padding:4px 8px;border-radius:4px;cursor:pointer;">Aktualisieren</button>`;
                            document.body.appendChild(updateNotice);
                        }
                    });
                });
            }).catch(err => {
                console.log('ServiceWorker registration failed');
            });
        }
    }
}

// Initialisierung
document.addEventListener('DOMContentLoaded', () => {
    new MobileEnhancements();
});

// Export für Module
export { MobileEnhancements };