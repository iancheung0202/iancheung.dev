(function() {
  "use strict";

  /**
   * Easy selector helper function
   */
  const select = (el, all = false) => {
    el = el.trim()
    if (all) {
      return [...document.querySelectorAll(el)]
    } else {
      return document.querySelector(el)
    }
  }

  /**
   * Easy event listener function
   */
  const on = (type, el, listener, all = false) => {
    let selectEl = select(el, all)

    if (selectEl) {
      if (all) {
        selectEl.forEach(e => e.addEventListener(type, listener))
      } else {
        selectEl.addEventListener(type, listener)
      }
    }
  }

  /**
   * Mobile nav toggle
   */
  on('click', '.mobile-nav-toggle', function(e) {
    const open = select('#navbar').classList.toggle('navbar-mobile')
    this.setAttribute('aria-expanded', open)
  })

  /**
   * Apply the saved theme on load (extensions.js owns applyTheme)
   */
  window.addEventListener('load', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    if (window.applyTheme) window.applyTheme(currentTheme === 'dark', false);
  });

  const toggleButton = select("#toggle-button");
  toggleButton.addEventListener("click", function() {
    const isDark = select("#toggle-button").getAttribute('data-tip') === 'Enable Light Mode';
    localStorage.setItem("theme", isDark ? 'dark' : 'light');
  });

  /**
   * Social links that open a small menu
   */
  const closeMenus = (except) => {
    select('.social-dropdown.open', true).forEach(d => {
      if (d !== except) {
        d.classList.remove('open')
        d.querySelector('a').setAttribute('aria-expanded', 'false')
      }
    })
  }
  on('click', '.social-dropdown > a', function(e) {
    e.preventDefault()
    const menu = this.parentElement
    const open = !menu.classList.contains('open')
    closeMenus(menu)
    menu.classList.toggle('open', open)
    this.setAttribute('aria-expanded', open)
  }, true)
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.social-dropdown')) closeMenus()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenus()
  })

})()
