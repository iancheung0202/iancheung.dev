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
   * Leaving home folds the hero into the top bar first, then the new page
   * loads already folded. Coming back, home starts folded and unfolds.
   */
  const header = select('#header')
  const isHome = header && !header.classList.contains('header-top')
  if (isHome && sessionStorage.getItem('folded')) {
    sessionStorage.removeItem('folded')
    header.classList.add('header-top', 'no-transition')
    requestAnimationFrame(() => requestAnimationFrame(() => {
      header.classList.remove('no-transition')
      header.classList.remove('header-top')
    }))
  }
  on('click', '#navbar a', function(e) {
    const href = this.getAttribute('href') || ''
    if (!isHome || !href.startsWith('/') || href === '/' || this.target === '_blank' || href.endsWith('.pdf')) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    select('#navbar').classList.remove('navbar-mobile')
    header.classList.add('header-top', 'leaving')
    sessionStorage.setItem('folded', '1')
    setTimeout(() => { window.location.href = href }, 320)
  }, true)
  // Restored from the back-forward cache: home was left folded, so unfold it.
  window.addEventListener('pageshow', e => {
    if (!e.persisted || !isHome) return
    sessionStorage.removeItem('folded')
    header.classList.remove('leaving')
    if (header.classList.contains('header-top')) {
      requestAnimationFrame(() => header.classList.remove('header-top'))
    }
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
  const openMenu = (menu, open) => {
    closeMenus(menu)
    menu.classList.toggle('open', open)
    if (open) {
      menu.classList.remove('flip', 'up')
      const r = menu.querySelector('.social-dropdown-menu').getBoundingClientRect()
      if (r.right > window.innerWidth - 8) menu.classList.add('flip')
      if (r.bottom > window.innerHeight - 8) menu.classList.add('up')
    }
    menu.querySelector('a').setAttribute('aria-expanded', open)
  }
  const hoverable = window.matchMedia('(hover: hover) and (pointer: fine)')
  let closeTimer = null
  on('click', '.social-dropdown > a', function(e) {
    e.preventDefault()
    const menu = this.parentElement
    openMenu(menu, hoverable.matches ? true : !menu.classList.contains('open'))
  }, true)
  select('.social-dropdown', true).forEach(menu => {
    menu.addEventListener('mouseenter', () => {
      if (!hoverable.matches) return
      clearTimeout(closeTimer)
      openMenu(menu, true)
    })
    menu.addEventListener('mouseleave', () => {
      if (!hoverable.matches) return
      closeTimer = setTimeout(() => openMenu(menu, false), 160)
    })
  })
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.social-dropdown')) closeMenus()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenus()
  })

})()
