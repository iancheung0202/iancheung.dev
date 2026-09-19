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
        var bgPath = 'assets/img/bg/';
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
            var creditsElem = select('.credits');
            var preloadImg = new Image();
            preloadImg.onload = function() {
                if (headerPhoto) headerPhoto.style.backgroundImage = "url('" + url + "')";
                if (filenameElem) filenameElem.innerHTML = filename.replace(/\.[^/.]+$/, "") + " 📸";
                requestAnimationFrame(function() {
                    if (headerPhoto) headerPhoto.classList.add('is-visible');
                    if (creditsElem) creditsElem.classList.add('is-visible');
                });
            };
            preloadImg.src = url;
        });
    })();


    /**
     * Initialize Discord activity feed
     */
    let activityStartTimes = [];
    async function fetchDiscordActivity() {
        const feed = select('#discord-activity-feed');
        const customStatusArea = select('#dc-custom-status-area');
        const statusBadge = select('#dc-status-badge');
        const symbol = document.querySelector('.dc-status-symbol');
        try {
            const res = await fetch('https://activity.fischl.app');
            if (!res.ok) throw new Error('Network error');
            const data = await res.json();

            if (data.discord_user && data.discord_user.avatar) {
                const avatarEl = select('#dc-avatar');
                if (avatarEl) {
                    avatarEl.src = `https://cdn.discordapp.com/avatars/${data.discord_user.id}/${data.discord_user.avatar}.png?size=128`;
                }
            }

            if (!data.activity || !Array.isArray(data.activity) || data.activity.length === 0) {
                if (customStatusArea) customStatusArea.innerHTML = '';
                feed.innerHTML = `
                <div class="dc-no-activity">
                    <i class="bi bi-moon-stars" style="font-size:24px;opacity:0.4;"></i>
                    <span>No activity right now. Check back soon!</span>
                </div>`;
                statusBadge.setAttribute('data-status', "Offline");
                statusBadge.setAttribute('title', "Offline");
                statusBadge.style.backgroundColor = '#80848e';
                symbol.classList.remove('dc-status-dnd-symbol');
                symbol.classList.add('dc-status-offline-symbol');
                return;
            } else {
                // Has activity = online (DND)
                statusBadge.setAttribute('data-status', "Do Not Disturb");
                statusBadge.setAttribute('title', "Do Not Disturb");
                statusBadge.style.backgroundColor = '#d5363c';
                symbol.classList.remove('dc-status-offline-symbol');
                symbol.classList.add('dc-status-dnd-symbol');

            }

            const customStatus = data.activity.find(a => parseInt(a.type) === 4);
            const regularActivities = data.activity.filter(a => parseInt(a.type) !== 4);

            if (customStatusArea) {
                if (customStatus) {
                    let emojiHtml = '';
                    if (customStatus.emoji && customStatus.emoji.name) {
                        if (customStatus.emoji.id) {
                            const ext = (customStatus.emoji.animated === true || customStatus.emoji.animated === 'True' || customStatus.emoji.animated === 'true') ? 'gif' : 'png';
                            emojiHtml = `<img src="https://cdn.discordapp.com/emojis/${customStatus.emoji.id}.${ext}" class="dc-custom-status-emoji-img" alt="${customStatus.emoji.name}">`;
                        } else {
                            emojiHtml = `<span class="dc-custom-status-emoji">${customStatus.emoji.name}</span>`;
                        }
                    }
                    const statusText = customStatus.state || customStatus.name || '';
                    customStatusArea.innerHTML = `
                    <div class="dc-custom-status-box">
                        ${emojiHtml}
                        <span class="dc-custom-status-text">${statusText}</span>
                    </div>`;
                } else {
                    customStatusArea.innerHTML = '';
                }
            }

            activityStartTimes = regularActivities.map(act => act.timestamps && act.timestamps.start ? parseInt(act.timestamps.start, 10) : null);
            if (regularActivities.length === 0) {
                feed.innerHTML = `
                <div class="dc-no-activity">
                    <i class="bi bi-moon-stars" style="font-size:24px;opacity:0.4;"></i>
                    <span>No activity right now. Check back soon!</span>
                </div>`;
            } else {
                feed.innerHTML = regularActivities.map((a, i) => renderActivity(a, i)).join('');
            }
            updateActivityTimers();
        } catch (e) {
            if (feed) feed.innerHTML = '<div class="dc-no-activity" style="color:#f23f43">Failed to load Discord status.</div>';
            console.error(e);
        }
    }

    function renderActivity(act, idx) {
        let sectionLabel;
        const type = parseInt(act.type);
        if (type === 2 || act.name === 'Spotify') {
            sectionLabel = 'LISTENING TO SPOTIFY';
        } else if (type === 1) {
            sectionLabel = 'LIVE ON TWITCH';
        } else if (type === 3) {
            sectionLabel = 'WATCHING';
        } else {
            sectionLabel = 'PLAYING';
        }

        let largeImg;
        if (act.name === 'Spotify' && act.assets && act.assets.large_image) {
            const src = act.assets.large_image.startsWith('spotify:')
                ? `https://i.scdn.co/image/${act.assets.large_image.replace('spotify:', '')}`
                : act.assets.large_image;
            largeImg = `<img src="${src}" class="dc-activity-large-img" alt="${act.name}">`;
        } else if (act.assets && act.assets.large_image && act.application_id) {
            largeImg = `<img src="https://cdn.discordapp.com/app-assets/${act.application_id}/${act.assets.large_image}.png" class="dc-activity-large-img" alt="${act.name}" onerror="this.outerHTML='<div class=\'dc-activity-icon-placeholder\'><i class=\'bi bi-controller\'></i></div>'">`;
        } else {
            largeImg = `<div class="dc-activity-icon-placeholder"><i class="bi bi-controller"></i></div>`;
        }

        let smallImg = '';
        if (act.assets && act.assets.small_image && act.application_id) {
            smallImg = `<img src="https://cdn.discordapp.com/app-assets/${act.application_id}/${act.assets.small_image}.png" class="dc-activity-small-img" alt="" onerror="this.style.display='none'">`;
        }

        let timerHtml = '';
        if (act.timestamps && act.timestamps.start) {
            timerHtml = `<div class="dc-activity-timer"><span class="discord-activity-timer" data-idx="${idx}">00:00:00</span></div>`;
        }

        return `<div>
            <div class="dc-activity-section-label">${sectionLabel}</div>
            <div class="dc-activity-box">
                <div class="dc-activity-thumb-wrap">${largeImg}${smallImg}</div>
                <div class="dc-activity-info">
                    <div class="dc-activity-name">${act.name || 'Unknown'}</div>
                    ${act.details ? `<div class="dc-activity-detail">${act.details}</div>` : ''}
                    ${act.state ? `<div class="dc-activity-state">${act.state}</div>` : ''}
                    ${timerHtml}
                </div>
            </div>
        </div>`;
    }

    fetchDiscordActivity();
    let discordPollInterval = setInterval(fetchDiscordActivity, 10000);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            clearInterval(discordPollInterval);
        } else {
            fetchDiscordActivity();
            discordPollInterval = setInterval(fetchDiscordActivity, 10000);
        }
    });

    function updateActivityTimers() {
        const now = Date.now();
        select('.discord-activity-timer', true).forEach(el => {
            const idx = el.getAttribute('data-idx');
            const start = activityStartTimes[idx];
            if (!start) return;
            let diff = Math.floor((now - start) / 1000);
            if (diff < 0) diff = 0;
            const h = String(Math.floor(diff / 3600)).padStart(2, '0');
            const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
            const s = String(diff % 60).padStart(2, '0');
            el.textContent = `${h}:${m}:${s}`;
        });
    }

    setInterval(updateActivityTimers, 1000);

    /**
     * Copy user ID button
     */
    document.addEventListener('DOMContentLoaded', () => {
        const copyBtn = select('#dc-copy-btn');
        if (!copyBtn) return;
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText('692254240290242601').then(() => {
                copyBtn.innerHTML = '<i class="bi bi-check2"></i>';
                setTimeout(() => { copyBtn.innerHTML = '<i class="bi bi-copy"></i>'; }, 1500);
            }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = '692254240290242601';
                ta.style.cssText = 'position:fixed;opacity:0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                copyBtn.innerHTML = '<i class="bi bi-check2"></i>';
                setTimeout(() => { copyBtn.innerHTML = '<i class="bi bi-copy"></i>'; }, 1500);
            });
        });
    });


    /**
     * Initialize window-div behavior and buttons
     */
    let windowDiv = select(".window-div");
    const toggleLightDarkButton = select('#toggle-button');

    function flipMobileNavToggleColor() { // Flip color of mobile nav toggle if in light mode  
        if (toggleLightDarkButton.getAttribute('title') !== "Enable Dark Mode") return;
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
        button.addEventListener("click", () => {
            windowDiv.style.visibility = "hidden";
            windowDiv.style.position = "absolute";
            windowDiv.style.left = "-9999px";
            flipMobileNavToggleColor();
        });
    });

    on('click', '#home', () => {
        windowDiv.style.visibility = "visible";
        windowDiv.style.position = "";
        windowDiv.style.left = "";
        flipMobileNavToggleColor();
    });

    select(".mobile-nav-toggle", true).forEach(element => {
        element.addEventListener('click', flipMobileNavToggleColor);
    });


    /**
     * Initialize nerd button for toggling monospace font
     */
    on('click', '#btn-code', () => {
        if (button.classList.contains("a-active")) {
            document.getElementsByTagName("BODY")[0].style.fontFamily = "Open Sans";
            select(".subtitle", true).forEach(el => el.style.fontFamily = "Open Sans");
            document.documentElement.style.setProperty('--ui-font', '"Open Sans", sans-serif');
            button.classList.remove("a-active");
        } else {
            document.getElementsByTagName("BODY")[0].style.fontFamily = "monospace";
            select(".subtitle", true).forEach(el => el.style.fontFamily = "monospace");
            document.documentElement.style.setProperty('--ui-font', 'monospace');
            button.classList.add("a-active");
        }
        windowDiv.style.height = 'auto'; 
    });


    /**
     * Initialize music button for playing/pausing music and showing confetti
     */
    const audio = document.getElementById("audio");
    const isChristmas = new Date().getMonth() === 11;
    if (isChristmas) {
        audio.src = "assets/audio/Jingle Bells.mp3";
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
    toggleLightDarkButton.setAttribute('title', 'Enable Dark Mode');

    const PITCHES = {
        light: { home: 'C4', story: 'E4', notes: 'G4', resume: 'C5' },
        dark: { home: 'B3', story: 'Eb4', notes: 'Gb4', resume: 'B4' }
    };
    const CHORDS = {
        light: ["C3", "G3", "C4"],
        dark: ["B2", "Gb3", "B3"]
    };

    window.applyTheme = function(isDark, playTone = false) {
        const mode = isDark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', mode);
        toggleLightDarkButton.setAttribute('title', isDark ? 'Enable Light Mode' : 'Enable Dark Mode');

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
        select('a[href="resume.pdf"]')?.setAttribute('data-pitch', pitches.resume);

        const tooltip = bootstrap.Tooltip.getInstance(toggleLightDarkButton);
        if (tooltip) {
            tooltip.setContent({ '.tooltip-inner': toggleLightDarkButton.getAttribute('title') });
        }
    };

    on('click', '#toggle-button', () => {
        const title = toggleLightDarkButton.getAttribute('title');
        const isCurrentlyLight = title === 'Enable Dark Mode';
        
        window.applyTheme(isCurrentlyLight, true);
    });


    /**
     * Initialize mobile nav toggle bar behaviour and wiggle animation
     */
    document.addEventListener('DOMContentLoaded', () => {
        const btn = select('#mobile-nav-toggle');
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
     * Initialize the markdown about me explorer
     */
    document.addEventListener('DOMContentLoaded', () => {
        const treeEl = select('#story-tree');
        const pageEl = select('#story-page');
        if (!treeEl || !pageEl) return;

        const pages = new Map();
        const pageByPath = new Map();
        const bodyCache = new Map();
        let renderToken = 0;
        let currentKey = null;

        const FRONT_MATTER = /^\uFEFF?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;
        const isMobile = window.matchMedia('(max-width: 768px)');
        const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' });

        const el = (tag, className, text) => {
            const node = document.createElement(tag);
            if (className) node.className = className;
            if (text !== undefined) node.textContent = text;
            return node;
        };

        const slugify = (text) => text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');
        const pageHref = (key) => `#story/${key.split('/').map(encodeURIComponent).join('/')}`;
        const keyFromHash = () => {
            const match = location.hash.match(/^#story\/(.+)$/);
            if (!match) return null;
            try {
                const key = match[1].split('/').map(decodeURIComponent).join('/');
                return pages.has(key) ? key : null;
            } catch (_) {
                return null;
            }
        };

        const syncUrl = () => {
            if (!currentKey || keyFromHash() !== null) return;
            if (!/^#story(\/|$)/.test(location.hash)) return;
            history.replaceState(history.state, '', pageHref(currentKey));
        };

        const isPlainClick = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

        const buildSidebar = (folders) => {
            treeEl.replaceChildren();

            folders.forEach((folder) => {
                const folderEl = el('li', 'story-folder');
                const label = el('span', 'story-folder-label');

                const fallbackIcon = () => el('span', 'story-folder-icon', '📁');
                if (folder.icon) {
                    const img = el('img', 'story-folder-icon');
                    img.alt = '';
                    img.src = folder.icon;
                    img.addEventListener('error', () => img.replaceWith(fallbackIcon()));
                    label.append(img);
                } else {
                    label.append(fallbackIcon());
                }
                label.append(el('span', null, folder.label));

                const list = el('ul');
                folder.pages.forEach((page) => {
                    const item = el('li');
                    const link = el('a', 'story-link', page.title);
                    link.href = pageHref(page.key);
                    link.dataset.page = page.key;
                    item.append(link);
                    list.append(item);
                });

                folderEl.append(label, list);
                treeEl.append(folderEl);
            });
        };

        treeEl.addEventListener('click', (e) => {
            const link = e.target.closest('a.story-link');
            if (!link || !isPlainClick(e)) return;
            e.preventDefault();
            showPage(link.dataset.page, { scroll: true });
        });

        const loadMarkdown = async (page) => {
            if (bodyCache.has(page.key)) return bodyCache.get(page.key);
            const res = await fetch(page.url, { cache: 'no-cache' });
            if (!res.ok) throw new Error(`HTTP ${res.status} for ${page.url}`);
            const text = (await res.text()).replace(FRONT_MATTER, '');
            bodyCache.set(page.key, text);
            return text;
        };

        const renderMarkdown = (md, page) => {
            if (typeof marked === 'undefined') throw new Error('marked failed to load');

            const tpl = document.createElement('template');
            tpl.innerHTML = marked.parse(md);
            const mdUrl = new URL(page.url, document.baseURI);

            const used = new Set();
            tpl.content.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
                const base = slugify(h.textContent) || 'section';
                let id = base;
                for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
                used.add(id);
                h.id = `story-${id}`;
            });

            tpl.content.querySelectorAll('img[src]').forEach((img) => {
                try {
                    img.setAttribute('src', new URL(img.getAttribute('src'), mdUrl).href);
                } catch (_) { /* leave as written */ }
            });

            tpl.content.querySelectorAll('a[href]').forEach((a) => {
                const href = a.getAttribute('href');

                if (href.startsWith('#')) {
                    let target = href.slice(1);
                    try { target = decodeURIComponent(target); } catch (_) {}
                    a.dataset.gardenAnchor = slugify(target);
                    return;
                }

                let url;
                try { url = new URL(href, mdUrl); } catch (_) { return; }
                if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

                if (url.origin !== location.origin) {
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    return;
                }

                const key = pageByPath.get(url.pathname);
                if (key) {
                    a.setAttribute('href', pageHref(key));
                    a.dataset.gardenPage = key;
                } else {
                    a.setAttribute('href', url.href);
                }
            });

            return tpl.content;
        };

        pageEl.addEventListener('click', (e) => {
            const a = e.target.closest('a');
            if (!a || !isPlainClick(e)) return;

            if (a.dataset.gardenPage) {
                e.preventDefault();
                showPage(a.dataset.gardenPage, { scroll: true });
            } else if (a.dataset.gardenAnchor !== undefined) {
                e.preventDefault();
                const target = document.getElementById(`story-${a.dataset.gardenAnchor}`);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });

        const preloadImages = (root, timeoutMs = 5000) => {
            const loads = [...root.querySelectorAll('img[src]')].map((img) => new Promise((resolve) => {
                const probe = new Image();
                probe.onload = probe.onerror = resolve;
                probe.src = img.getAttribute('src');
            }));
            if (!loads.length) return Promise.resolve();
            return Promise.race([
                Promise.all(loads),
                new Promise((resolve) => setTimeout(resolve, timeoutMs)),
            ]);
        };

        const showPage = async (key, { updateUrl = true, scroll = false } = {}) => {
            const page = pages.get(key);
            if (!page) return;
            const token = ++renderToken;
            currentKey = key;

            treeEl.querySelectorAll('.story-link').forEach((link) => {
                link.classList.toggle('active', link.dataset.page === key);
            });

            if (updateUrl && location.hash !== pageHref(key)) history.pushState(null, '', pageHref(key));

            let body;
            try {
                const md = await loadMarkdown(page);
                body = renderMarkdown(md, page);
                await preloadImages(body);
            } catch (err) {
                console.error('[garden]', err);
                body = el('p', 'story-status', 'this page could not be loaded.');
            }
            if (token !== renderToken) return; 

            const article = el('article', 'story-page-inner');
            const content = el('div', 'story-content');
            content.append(body);

            const meta = el('div', 'story-meta');
            const updated = new Date(page.updated);
            if (!isNaN(updated)) {
                const time = el('time', null, dateFormat.format(updated));
                time.dateTime = updated.toISOString();
                meta.append('Last updated: ', time);
            }

            article.append(
                el('div', 'story-breadcrumb', `${page.folderLabel} /`),
                el('h3', null, page.title),
                content,
                meta
            );

            // Single swap: title, content and images all appear together.
            pageEl.replaceChildren(article);

            if (scroll && (isMobile.matches || pageEl.getBoundingClientRect().top < 0)) {
                pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };

        const onLocationChange = () => {
            const key = keyFromHash();
            if (key && key !== currentKey) showPage(key, { updateUrl: false });
        };
        window.addEventListener('popstate', onLocationChange);
        window.addEventListener('hashchange', onLocationChange);

        const storySection = select('#story');
        if (storySection) {
            new MutationObserver(syncUrl).observe(storySection, { attributes: true, attributeFilter: ['class'] });
        }

        const init = async () => {
            try {
                const res = await fetch('api/about', { cache: 'no-cache' });
                if (!res.ok) throw new Error(`HTTP ${res.status} for api/about`);
                const { folders } = await res.json();

                folders.forEach((folder) => folder.pages.forEach((page) => {
                    page.folderLabel = folder.label;
                    pages.set(page.key, page);
                    pageByPath.set(new URL(page.url, document.baseURI).pathname, page.key);
                }));

                if (!pages.size) {
                    treeEl.replaceChildren(el('li', 'story-status', 'nothing here yet.'));
                    pageEl.replaceChildren(el('div', 'story-status', 'no pages have been written yet.'));
                    return;
                }

                buildSidebar(folders);
                showPage(keyFromHash() || folders[0].pages[0].key, { updateUrl: false });
                syncUrl();
            } catch (err) {
                console.error('[garden]', err);
                treeEl.replaceChildren(el('li', 'story-status', 'couldn\'t load the page list.'));
                pageEl.replaceChildren(el('div', 'story-status', 'something went wrong while loading the pages.'));
            }
        };

        init();
    });

    /**
     * Initialize mobile nav full-screen behavior
     */

    const navbar = document.getElementById('navbar');
    const mobileNavObserver = new MutationObserver(() => {
        if (navbar.classList.contains('navbar-mobile')) {
            navbar.style.position = 'fixed';
            navbar.style.top = '0';
            navbar.style.left = '0';
            navbar.style.width = '100%';
            navbar.style.height = '100vh';
            navbar.style.background = 'var(--background-color)';
            navbar.style.zIndex = '9999';
            navbar.style.overflowY = 'auto';
            navbar.style.paddingTop = '60px'; 
        } else {
            navbar.style.position = '';
            navbar.style.top = '';
            navbar.style.left = '';
            navbar.style.width = '';
            navbar.style.height = '';
            navbar.style.background = '';
            navbar.style.zIndex = '';
            navbar.style.overflowY = '';
            navbar.style.paddingTop = '';
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
                        window.webSynth.volume.value = -12; // Lower the volume to prevent it from being too loud
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