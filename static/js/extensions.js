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
     * Initialize header background image
     */
    (function() {
        // ls *.jpg *.jpeg *.png 2>/dev/null | sed -e 's/^/"/' -e 's/$/",/' | sed '$s/,$//' | (echo '[' && cat - && echo ']') > manifest.json
        var bgPath = '/img/bg/';
        fetch(bgPath + 'manifest.json').then(function(resp) {
            if (!resp.ok) return;
            return resp.json();
        }).then(function(list) {
            if (!Array.isArray(list) || !list.length) return;
            var idx = Math.floor(Math.random() * list.length);
            var filename = list[idx];
            var url = bgPath + encodeURIComponent(filename);
            var headerPhoto = select('.header-photo');
            var filenameElem = select('#photo-filename');
            var footerElem = select('.footer');
            var preloadImg = new Image();
            preloadImg.onload = function() {
                if (headerPhoto) headerPhoto.style.backgroundImage = "url('" + url + "')";
                if (filenameElem) filenameElem.innerHTML = filename.replace(/\.[^/.]+$/, "") + " 📸";
                requestAnimationFrame(function() {
                    if (headerPhoto) headerPhoto.classList.add('is-visible');
                    if (footerElem) footerElem.classList.add('is-visible');
                });
            };
            preloadImg.src = url;
        });
    })();


    /**
     * "right now" line in the hero, fed by the Discord presence endpoint.
     * Hidden unless the endpoint answers.
     */
    (function() {
        const line = select('#right-now');
        if (!line) return;
        const dot = line.querySelector('.right-now-dot');
        const text = line.querySelector('.right-now-text');
        const WORDS = {
            offline: 'away from the keyboard',
            listening: (a) => `listening to ${a.details || a.name}${a.state ? ', ' + a.state : ''}`,
            streaming: (a) => `live on twitch`,
            watching: (a) => `watching ${a.name}`,
            playing: (a) => `playing ${a.name}${a.details ? ', ' + a.details : ''}`,
        };
        const since = (a) => {
            const start = a.timestamps && parseInt(a.timestamps.start, 10);
            if (!start) return '';
            const mins = Math.max(1, Math.floor((Date.now() - start) / 60000));
            return mins < 60 ? ` for ${mins} min` : ` for ${Math.floor(mins / 60)} h ${mins % 60} min`;
        };

        async function refresh() {
            try {
                const res = await fetch('https://activity.fischl.app');
                if (!res.ok) throw new Error(res.status);
                const data = await res.json();
                const acts = Array.isArray(data.activity) ? data.activity : [];
                const custom = acts.find(a => parseInt(a.type) === 4);
                const act = acts.find(a => parseInt(a.type) !== 4);
                let state = 'offline', words = WORDS.offline;
                if (act) {
                    const type = parseInt(act.type);
                    state = 'busy';
                    const kind = (type === 2 || act.name === 'Spotify') ? 'listening' : type === 1 ? 'streaming' : type === 3 ? 'watching' : 'playing';
                    words = WORDS[kind](act) + since(act);
                } else if (custom && (custom.state || custom.name)) {
                    state = 'around';
                    words = custom.state || custom.name;
                }
                dot.dataset.state = state;
                text.textContent = words;
                line.hidden = false;
            } catch (e) {
                line.hidden = true;
            }
        }

        refresh();
        let timer = setInterval(refresh, 30000);
        document.addEventListener('visibilitychange', () => {
            clearInterval(timer);
            if (!document.hidden) { refresh(); timer = setInterval(refresh, 30000); }
        });
    })();


    /**
     * Hero toggle buttons
     */
    const toggleLightDarkButton = select('#toggle-button');

    function flipMobileNavToggleColor() { // Flip color of mobile nav toggle if in light mode
        if (toggleLightDarkButton.getAttribute('data-tip') !== "Enable Dark Mode") return;
        const rootStyles = getComputedStyle(document.documentElement);
        const currentColor = rootStyles.getPropertyValue('--mobile-nav-toggle-color').trim();

        if (currentColor === 'rgb(255, 255, 255)') {
            document.documentElement.style.setProperty('--mobile-nav-toggle-color', 'rgb(0, 0, 0)');
        } else if (currentColor === 'rgb(0, 0, 0)') {
            document.documentElement.style.setProperty('--mobile-nav-toggle-color', 'rgb(255, 255, 255)');
        }
    }

    select('.page', true).forEach(button => {
        if (button.classList.contains('non-nav-link')) {return;}
        button.addEventListener("click", flipMobileNavToggleColor);
    });

    on('click', '#home', flipMobileNavToggleColor);

    select(".mobile-nav-toggle", true).forEach(element => {
        element.addEventListener('click', flipMobileNavToggleColor);
    });


    /**
     * Initialize nerd button for toggling monospace font
     */
    on('click', '#btn-code', () => {
        const root = document.documentElement;
        const on_ = root.getAttribute('data-nerd') !== 'on';
        root.setAttribute('data-nerd', on_ ? 'on' : 'off');
        select('#btn-code').classList.toggle('a-active', on_);
        try { localStorage.setItem('nerd', on_ ? 'on' : 'off'); } catch (_) { /* ignore */ }
    });
    if (document.documentElement.getAttribute('data-nerd') === 'on') select('#btn-code')?.classList.add('a-active');


    /**
     * Initialize music button for playing/pausing music and showing confetti
     */
    const audio = document.getElementById("audio");
    const isChristmas = new Date().getMonth() === 11;
    if (isChristmas) {
        audio.src = "/audio/Jingle Bells.mp3";
    }
    const button = select("#btn-play");
    let isOut;
    on('click', '#btn-play', () => {
        if (button.classList.contains("a-active")) {
            audio.pause();
            button.classList.remove("a-active");
            document.getElementById("confetti").remove();
        } else {
            audio.play();
            button.classList.add("a-active")
            loadConfetti();
        }
    });

    function loadConfetti() {
        var random = Math.random
        , cos = Math.cos
        , sin = Math.sin
        , PI = Math.PI
        , PI2 = PI * 2
        , timer = undefined
        , frame = undefined
        , confetti = [];

        var particles = 10
        , spread = 40
        , sizeMin = 3
        , sizeMax = 12 - sizeMin
        , eccentricity = 10
        , deviation = 100
        , dxThetaMin = -.1
        , dxThetaMax = -dxThetaMin - dxThetaMin
        , dyMin = .13
        , dyMax = .18
        , dThetaMin = .4
        , dThetaMax = .7 - dThetaMin;

        var colorThemes = [
        function() {
            return color(200 * random()|0, 200 * random()|0, 200 * random()|0);
        }, function() {
            var black = 200 * random()|0; return color(200, black, black);
        }, function() {
            var black = 200 * random()|0; return color(black, 200, black);
        }, function() {
            var black = 200 * random()|0; return color(black, black, 200);
        }, function() {
            return color(200, 100, 200 * random()|0);
        }, function() {
            return color(200 * random()|0, 200, 200);
        }, function() {
            var black = 256 * random()|0; return color(black, black, black);
        }, function() {
            return colorThemes[random() < .5 ? 1 : 2]();
        }, function() {
            return colorThemes[random() < .5 ? 3 : 5]();
        }, function() {
            return colorThemes[random() < .5 ? 2 : 4]();
        }
        ];
        function color(r, g, b) {return 'rgb(' + r + ',' + g + ',' + b + ')';}

        function interpolation(a, b, t) {return (1-cos(PI*t))/2 * (b-a) + a;}

        var radius = 1/eccentricity, radius2 = radius+radius;
        function createPoisson() {
        var domain = [radius, 1-radius], measure = 1-radius2, spline = [0, 1];
        while (measure) {
            var dart = measure * random(), i, l, interval, a, b, c, d;

            for (i = 0, l = domain.length, measure = 0; i < l; i += 2) {
            a = domain[i], b = domain[i+1], interval = b-a;
            if (dart < measure+interval) {
                spline.push(dart += a-measure);
                break;
            }
            measure += interval;
            }
            c = dart-radius, d = dart+radius;

            for (i = domain.length-1; i > 0; i -= 2) {
            l = i-1, a = domain[l], b = domain[i];
            if (a >= c && a < d)
                if (b > d) domain[l] = d;
                else domain.splice(l, 2);
            else if (a < c && b > c)
                if (b <= d) domain[i] = c;
                else domain.splice(i, 0, c, d);
            }

            for (i = 0, l = domain.length, measure = 0; i < l; i += 2)
            measure += domain[i+1]-domain[i];
        }

        return spline.sort();
        }

        var container = document.createElement('div');
        container.id = "confetti";
        container.style.position = 'fixed';
        container.style.top      = '0';
        container.style.left     = '0';
        container.style.width    = '100%';
        container.style.height   = '0';
        container.style.overflow = 'visible';
        container.style.zIndex   = '9999';

        function Confetto(theme) {
            this.frame = 0;
            this.outer = document.createElement('div');
            this.inner = document.createElement('div');
            this.outer.appendChild(this.inner);

            var outerStyle = this.outer.style, innerStyle = this.inner.style;
            outerStyle.position = 'absolute';
            outerStyle.width  = (sizeMin + sizeMax * random()) + 'px';
            outerStyle.height = (sizeMin + sizeMax * random()) + 'px';
            innerStyle.width  = '100%';
            innerStyle.height = '100%';
            if (isChristmas) {
                innerStyle.backgroundImage = "url('https://avatars.githubusercontent.com/u/6453780?s=280&v=4')";
                innerStyle.backgroundSize = "contain";
                innerStyle.backgroundRepeat = "no-repeat";
                innerStyle.backgroundColor = "transparent";
            } else {
                innerStyle.backgroundColor = theme();
            }

            outerStyle.perspective = '50px';
            outerStyle.transform = 'rotate(' + (360 * random()) + 'deg)';
            this.axis = 'rotate3D(' +
                cos(360 * random()) + ',' +
                cos(360 * random()) + ',0,';
            this.theta = 360 * random();
            this.dTheta = dThetaMin + dThetaMax * random();
            innerStyle.transform = this.axis + this.theta + 'deg)';

            this.x = window.innerWidth * random();
            this.y = -deviation;
            this.dx = sin(dxThetaMin + dxThetaMax * random());
            this.dy = dyMin + dyMax * random();
            outerStyle.left = this.x + 'px';
            outerStyle.top  = this.y + 'px';

            this.splineX = createPoisson();
            this.splineY = [];
            for (var i = 1, l = this.splineX.length-1; i < l; ++i)
                this.splineY[i] = deviation * random();
            this.splineY[0] = this.splineY[l] = deviation * random();

            this.update = function(height, delta) {
                this.frame += delta;
                this.x += this.dx * delta;
                this.y += this.dy * delta;
                this.theta += this.dTheta * delta;

                var phi = this.frame % 7777 / 7777, i = 0, j = 1;
                while (phi >= this.splineX[j]) i = j++;
                var rho = interpolation(
                this.splineY[i],
                this.splineY[j],
                (phi-this.splineX[i]) / (this.splineX[j]-this.splineX[i])
                );
                phi *= PI2;

                outerStyle.left = this.x + rho * cos(phi) + 'px';
                outerStyle.top  = this.y + rho * sin(phi) + 'px';
                innerStyle.transform = this.axis + this.theta + 'deg)';
                return this.y > height+deviation;
            };
        }

        function poof() {
            if (!frame) {
                document.body.appendChild(container);
                var theme = colorThemes[0]
                , count = 0;

                (function addConfetto() {
                var confetto = new Confetto(theme);
                confetti.push(confetto);
                container.appendChild(confetto.outer);
                timer = setTimeout(addConfetto, spread * random());
                })(0);

                var prev = undefined;
                requestAnimationFrame(function loop(timestamp) {
                var delta = prev ? timestamp - prev : 0;
                prev = timestamp;
                var height = window.innerHeight;

                for (var i = confetti.length-1; i >= 0; --i) {
                    if (confetti[i].update(height, delta)) {
                    container.removeChild(confetti[i].outer);
                    confetti.splice(i, 1);
                    }
                }

                if (timer || confetti.length)
                    return frame = requestAnimationFrame(loop);

                document.body.removeChild(container);
                frame = undefined;
                });
            }
        }
        if (isOut == true) {return 0;} else {poof();}
    };


    /**
     * Initialize light/dark mode toggle button
     */
    toggleLightDarkButton.setAttribute('data-tip', 'Enable Dark Mode');

    const PITCHES = {
        light: { home: 'C4', story: 'E4', notes: 'G4', class: 'Bb4', resume: 'C5' },
        dark: { home: 'B3', story: 'Eb4', notes: 'Gb4', class: 'A4', resume: 'B4' }
    };
    const CHORDS = {
        light: ["C3", "G3", "C4"],
        dark: ["B2", "Gb3", "B3"]
    };

    window.applyTheme = function(isDark, playTone = false) {
        const mode = isDark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', mode);
        toggleLightDarkButton.setAttribute('data-tip', isDark ? 'Enable Light Mode' : 'Enable Dark Mode');

        if (playTone && typeof Tone !== 'undefined') {
            Tone.start();
            if (!window.webSynth) {
                window.webSynth = new Tone.PolySynth(Tone.Synth).toDestination();
                window.webSynth.volume.value = -12;
            }
            const now = Tone.now();
            CHORDS[mode].forEach((note, i) => {
                window.webSynth.triggerAttackRelease(note, "8n", now + i * 0.2);
            });
        }

        const pitches = PITCHES[mode];
        select('#home')?.setAttribute('data-pitch', pitches.home);
        select('#nav-story')?.setAttribute('data-pitch', pitches.story);
        select('#nav-notes')?.setAttribute('data-pitch', pitches.notes);
        select('#nav-class')?.setAttribute('data-pitch', pitches.class);
        select('#resume-nav-link')?.setAttribute('data-pitch', pitches.resume);

    };

    on('click', '#toggle-button', () => {
        const title = toggleLightDarkButton.getAttribute('data-tip');
        const isCurrentlyLight = title === 'Enable Dark Mode';

        window.applyTheme(isCurrentlyLight, true);
    });


    /**
     * Initialize mobile nav toggle bar behaviour and wiggle animation
     */
    document.addEventListener('DOMContentLoaded', () => {
        const btn = select('#mobile-nav-toggle');
        const footer = select('.footer');
        if (!btn) return;

        function addClassAfterDelay() {
        setTimeout(function() {
            if (!btn.classList.contains('clicked')) {
            btn.classList.add('wobble');
            }
        }, 4000);
        }
        function removeClassOnClick() {
            btn.classList.remove('wobble');
            btn.classList.add('clicked');
            btn.removeEventListener('click', removeClassOnClick);
        }
        btn.addEventListener('click', () => {
            if (footer) footer.classList.toggle('is-visible');
        });
        addClassAfterDelay();
        btn.addEventListener('click', removeClassOnClick);
    });

    document.addEventListener('DOMContentLoaded', () => {
        const hoverGroups = [
            ['#github-easter-egg-text', ['#github-icon-link']],
            ['#resume-easter-egg-text', ['#resume-nav-link']],
            ['#applied-math-text', ['#linkedin-icon-link']],
            ['#reach-out-text', ['#email-icon-link']],
            ['#discord-bots-text', ['#discord-icon-link']],
            ['#social-media-manager-text', ['#discord-icon-link', '#youtube-icon-link', '#instagram-icon-link']],
            ['#fullstack-text', ['#github-icon-link', '#homelab-nav-link']],
        ];

        hoverGroups.forEach(([triggerSelector, targetSelectors]) => {
            const trigger = select(triggerSelector);
            const targets = targetSelectors.map(selector => select(selector)).filter(Boolean);

            if (!trigger || targets.length === 0) return;

            const startWobble = () => {
                targets.forEach(target => {
                    target.classList.remove('wobble');
                    void target.offsetWidth;
                    target.classList.add('wobble');
                });
            };

            const stopWobble = () => {
                targets.forEach(target => target.classList.remove('wobble'));
            };

            trigger.addEventListener('mouseenter', startWobble);
            trigger.addEventListener('mouseleave', stopWobble);
            trigger.addEventListener('focus', startWobble);
            trigger.addEventListener('blur', stopWobble);
        });
    });

    /**
     * Mobile nav: while open, the menu lives directly under <body>.
     * Inside #header it is clipped once the header turns into the fixed,
     * overflow-hidden top bar (seen on iPad). Moving it out avoids any
     * ancestor clipping or stacking context in every engine.
     */

    const navbar = document.getElementById('navbar');
    const navHome = { parent: navbar.parentNode, next: navbar.nextSibling };
    const mobileNavObserver = new MutationObserver(() => {
        const open = navbar.classList.contains('navbar-mobile');
        if (open && navbar.parentNode !== document.body) {
            document.body.appendChild(navbar);
        } else if (!open && navbar.parentNode === document.body) {
            navHome.parent.insertBefore(navbar, navHome.next);
        }
    });
    mobileNavObserver.observe(navbar, { attributes: true, attributeFilter: ['class'] });

    /**
     * Pitch playback on nav hover
     */
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof Tone !== 'undefined') {
            let audioUnlocked = false;

            const unlockAudio = async () => {
                if (!audioUnlocked) {
                    await Tone.start();
                    if (!window.webSynth) {
                        window.webSynth = new Tone.PolySynth(Tone.Synth).toDestination();
                        window.webSynth.volume.value = -12;
                    }
                    audioUnlocked = true;
                    document.removeEventListener('click', unlockAudio);
                    document.removeEventListener('keydown', unlockAudio);
                    document.removeEventListener('touchstart', unlockAudio);
                }
            };

            document.addEventListener('click', unlockAudio);
            document.addEventListener('keydown', unlockAudio);
            document.addEventListener('touchstart', unlockAudio);

            document.querySelectorAll('#navbar a').forEach(item => {
                item.addEventListener('mouseenter', () => {
                    const pitch = item.getAttribute('data-pitch');
                    if (pitch && audioUnlocked && window.webSynth) {
                        window.webSynth.triggerAttackRelease(pitch, "16n");
                    }
                });
            });
        }
    });

})();
