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
   * Scrolls to an element with header offset
   */
  const scrollto = (el) => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
    if (el !== '#header') {
      history.pushState(null, null, el);
    } else {
      history.pushState(null, null, ' ');
    }
  }  

  /**
   * Tracks back and forward page
   */

  window.addEventListener('popstate', () => {
    let section;
  
    if (!window.location.hash || window.location.hash === '#header') {
      // If there's no hash or the hash is #header, we're on the home page
      section = select('#header');
      select('#header').classList.remove('header-top');
    } else {
      section = select(window.location.hash);
      select('#header').classList.add('header-top');
    }
  
    let sections = select('section', true);
    sections.forEach((item) => {
      item.classList.remove('section-show');
    });
  
    if (section) {
      section.classList.add('section-show');
    }
  
    // Update the active class on the navbar links
    let navlinks = select('#navbar .nav-link', true);
    navlinks.forEach((item) => {
      item.classList.remove('active');
      if (item.getAttribute('href') === window.location.hash) {
        item.classList.add('active');
      }
    });
  
    // Handle the case for the home page with no hash
    if (!window.location.hash || window.location.hash === '#header') {
      navlinks[0].classList.add('active'); // Assuming the first link is the home link
    }
  });
  
  
  /**
   * Mobile nav toggle
   */
  on('click', '.mobile-nav-toggle', function(e) {
    select('#navbar').classList.toggle('navbar-mobile')
    this.classList.toggle('bi-list')
    this.classList.toggle('bi-x')
  })

  /**
   * Scroll with offset on links with a class name .scrollto
   */
  on('click', '#navbar .nav-link', function(e) {
    let section = select(this.hash)
    if (section) {
      e.preventDefault()

      let navbar = select('#navbar')
      let header = select('#header')
      let sections = select('section', true)
      let navlinks = select('#navbar .nav-link', true)

      navlinks.forEach((item) => {
        item.classList.remove('active')
      })

      this.classList.add('active')

      if (navbar.classList.contains('navbar-mobile')) {
        navbar.classList.remove('navbar-mobile')
        let navbarToggle = select('.mobile-nav-toggle')
        navbarToggle.classList.toggle('bi-list')
        navbarToggle.classList.toggle('bi-x')
      }

      if (this.hash === '#header') {
        header.classList.remove('header-top')
        sections.forEach((item) => {
          item.classList.remove('section-show')
        })
        scrollto(this.hash) // Move to the top of the page with hash
        return;
      }

      if (!header.classList.contains('header-top')) {
        header.classList.add('header-top')
        setTimeout(function() {
          sections.forEach((item) => {
            item.classList.remove('section-show')
          })
          section.classList.add('section-show')
        }, 350);
      } else {
        sections.forEach((item) => {
          item.classList.remove('section-show')
        })
        section.classList.add('section-show')
      }
      scrollto(this.hash)
    }
  }, true)

  /**
   * Activate/show sections on load with hash links
   */
  window.addEventListener('load', () => {
    let viewModeBtn = select("#toggle-button");
    const userTheme = localStorage.getItem("theme");
    viewModeBtn.click()
    if (!userTheme || userTheme === "light") {
      viewModeBtn.click()
    } 

    if (window.location.hash) {
      let initial_nav = select(window.location.hash)

      if (initial_nav) {
        let header = select('#header')
        let navlinks = select('#navbar .nav-link', true)

        header.classList.add('header-top')

        navlinks.forEach((item) => {
          if (item.getAttribute('href') === window.location.hash) {
            item.classList.add('active')
          } else {
            item.classList.remove('active')
          }
        })

        setTimeout(function() {
          initial_nav.classList.add('section-show')
        }, 350);

        scrollto(window.location.hash)
        let windowDiv = select(".window-div");
        windowDiv.style.visibility = "hidden";
        windowDiv.style.display = "none";
      }
    }
  });

  const toggleButton = select("#toggle-button");
  toggleButton.addEventListener("click", function() {
    localStorage.setItem("theme", document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light");
  });

  /**
   * Initiate Bootstrap tooltips
   */
  select('[data-toggle="tooltip"]', true).forEach(tooltipTriggerEl => {
    new bootstrap.Tooltip(tooltipTriggerEl)
  })

  /**
   * Initiate Pure Counter 
   */
  new PureCounter();

})()