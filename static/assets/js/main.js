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
        windowDiv = document.querySelector(".window-div");
        windowDiv.style.visibility = "hidden";
        windowDiv.style.display = "none";
      }
    }
  });

  /**
   * Skills animation
   */
  let skilsContent = select('.skills-content');
  if (skilsContent) {
    new Waypoint({
      element: skilsContent,
      offset: '80%',
      handler: function(direction) {
        let progress = select('.progress .progress-bar', true);
        progress.forEach((el) => {
          el.style.width = el.getAttribute('aria-valuenow') + '%'
        });
      }
    })
  }

  /**
   * Testimonials slider
   */
  // new Swiper('.testimonials-slider', {
  //   speed: 600,
  //   loop: true,
  //   autoplay: {
  //     delay: 5000,
  //     disableOnInteraction: false
  //   },
  //   slidesPerView: 'auto',
  //   pagination: {
  //     el: '.swiper-pagination',
  //     type: 'bullets',
  //     clickable: true
  //   },
  //   breakpoints: {
  //     320: {
  //       slidesPerView: 1,
  //       spaceBetween: 20
  //     },

  //     1200: {
  //       slidesPerView: 3,
  //       spaceBetween: 20
  //     }
  //   }
  // });

  /**
   * Portfolio isotope and filter
   */
  window.addEventListener('load', () => {
    let portfolioContainer = select('.portfolio-container');
    if (portfolioContainer) {
      let portfolioIsotope = new Isotope(portfolioContainer, {
        itemSelector: '.portfolio-item',
        layoutMode: 'fitRows'
      });

      let portfolioFilters = select('#portfolio-flters li', true);

      on('click', '#portfolio-flters li', function(e) {
        e.preventDefault();
        portfolioFilters.forEach(function(el) {
          el.classList.remove('filter-active');
        });
        this.classList.add('filter-active');

        portfolioIsotope.arrange({
          filter: this.getAttribute('data-filter')
        });
      }, true);
    }

  });

  /**
   * Initiate portfolio lightbox 
   */
  // const portfolioLightbox = GLightbox({
  //   selector: '.portfolio-lightbox'
  // });

  /**
   * Initiate portfolio details lightbox 
   */
  // const portfolioDetailsLightbox = GLightbox({
  //   selector: '.portfolio-details-lightbox',
  //   width: '90%',
  //   height: '90vh'
  // });

  /**
   * Portfolio details slider
   */
  // new Swiper('.portfolio-details-slider', {
  //   speed: 400,
  //   loop: true,
  //   autoplay: {
  //     delay: 5000,
  //     disableOnInteraction: false
  //   },
  //   pagination: {
  //     el: '.swiper-pagination',
  //     type: 'bullets',
  //     clickable: true
  //   }
  // });

  /**
   * Initiate Pure Counter 
   */
  new PureCounter();

})()


function resumeAcademic() {
  $("#resume-all").removeClass("resume-active");
  $(".resume-item-academic").css("visibility", "visible")
  $(".resume-item-academic").css("display", "block")
  $(".resume-item-music").css("visibility", "hidden")
  $(".resume-item-music").css("display", "none")
  $(".resume-item-coding").css("visibility", "hidden")
  $(".resume-item-coding").css("display", "none")
  $(".resume-item-others").css("visibility", "hidden")
  $(".resume-item-others").css("display", "none")
}
function resumeMusic() {
  $("#resume-all").removeClass("resume-active");
  $(".resume-item-academic").css("visibility", "hidden")
  $(".resume-item-academic").css("display", "none")
  $(".resume-item-music").css("visibility", "visible")
  $(".resume-item-music").css("display", "block")
  $(".resume-item-coding").css("visibility", "hidden")
  $(".resume-item-coding").css("display", "none")
  $(".resume-item-others").css("visibility", "hidden")
  $(".resume-item-others").css("display", "none")
}
function resumeCoding() {
  $("#resume-all").removeClass("resume-active");
  $(".resume-item-academic").css("visibility", "hidden")
  $(".resume-item-academic").css("display", "none")
  $(".resume-item-music").css("visibility", "hidden")
  $(".resume-item-music").css("display", "none")
  $(".resume-item-coding").css("visibility", "visible")
  $(".resume-item-coding").css("display", "block")
  $(".resume-item-others").css("visibility", "hidden")
  $(".resume-item-others").css("display", "none")
}
function resumeOthers() {
  $("#resume-all").removeClass("resume-active");
  $(".resume-item-academic").css("visibility", "hidden")
  $(".resume-item-academic").css("display", "none")
  $(".resume-item-music").css("visibility", "hidden")
  $(".resume-item-music").css("display", "none")
  $(".resume-item-coding").css("visibility", "hidden")
  $(".resume-item-coding").css("display", "none")
  $(".resume-item-others").css("visibility", "visible")
  $(".resume-item-others").css("display", "block")
}
function resumeAll() {
  $("#resume-all").addClass("resume-active");
  $(".resume-item-academic").css("visibility", "visible")
  $(".resume-item-academic").css("display", "block")
  $(".resume-item-music").css("visibility", "visible")
  $(".resume-item-music").css("display", "block")
  $(".resume-item-coding").css("visibility", "visible")
  $(".resume-item-coding").css("display", "block")
  $(".resume-item-others").css("visibility", "visible")
  $(".resume-item-others").css("display", "block")
}
