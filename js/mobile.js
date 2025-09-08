// Mobile-specific enhancements for Borbarad
//
// This script adds a simple toggle for the navigation on small screens. It does not
// modify existing logic; instead, it enhances the UI by collapsing the menu into
// a hamburger-style overlay when space is limited. The toggle button is only
// visible on screens below the defined CSS breakpoint (see styles.css). When the
// menu is open, the authentication controls are displayed below the links to
// ensure sign-in and registration remain accessible.

document.addEventListener('DOMContentLoaded', () => {
  const menu = document.getElementById('menu');
  const toggle = document.getElementById('menu-toggle');
  const authbox = document.getElementById('authbox');
  if (!menu || !toggle) return;

  // Close the menu whenever a navigation link is clicked.
  function closeMenu() {
    menu.classList.remove('open');
  }

  toggle.addEventListener('click', () => {
    menu.classList.toggle('open');
  });

  // Close the menu when clicking outside of it for better UX.
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!menu.contains(target) && target !== toggle) {
      menu.classList.remove('open');
    }
  });

  // When a menu link is clicked, close the overlay.
  menu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', closeMenu);
  });
});