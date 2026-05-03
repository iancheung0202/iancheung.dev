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
            var header = select('#header');
            var filenameElem = select('#photo-filename');
            var preloadImg = new Image();
            preloadImg.onload = function() {
                if (header) header.style.backgroundImage = "linear-gradient(rgba(0,0,0,0.7),rgba(0,0,0,0.7)),url('" + url + "')";
                if (filenameElem) filenameElem.textContent = filename.replace(/\.[^/.]+$/, "");
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

    select('.page', true).forEach(button => {
        if (button.classList.contains('non-nav-link')) {return;}
        button.addEventListener("click", () => {
            windowDiv.style.visibility = "hidden";
            windowDiv.style.position = "absolute";
            windowDiv.style.left = "-9999px";

            /* Flip color of mobile nav toggle if in light mode */
            if (toggleLightDarkButton.getAttribute('title') === "Enable Dark Mode") {
                const rootStyles = getComputedStyle(document.documentElement);
                const currentColor = rootStyles.getPropertyValue('--mobile-nav-toggle-color').trim();

                if (currentColor === 'rgb(255, 255, 255)') {
                    document.documentElement.style.setProperty('--mobile-nav-toggle-color', 'rgb(0, 0, 0)');
                } else if (currentColor === 'rgb(0, 0, 0)') {
                    document.documentElement.style.setProperty('--mobile-nav-toggle-color', 'rgb(255, 255, 255)');
                }
            }
        });
    });

    on('click', '#home', () => {
        windowDiv.style.visibility = "visible";
        windowDiv.style.position = "";
        windowDiv.style.left = "";

        /* Flip color of mobile nav toggle if in light mode */
        if (toggleLightDarkButton.getAttribute('title') === "Enable Dark Mode") {
            const rootStyles = getComputedStyle(document.documentElement);
            const currentColor = rootStyles.getPropertyValue('--mobile-nav-toggle-color').trim();

            if (currentColor === 'rgb(255, 255, 255)') {
                document.documentElement.style.setProperty('--mobile-nav-toggle-color', 'rgb(0, 0, 0)');
            } else if (currentColor === 'rgb(0, 0, 0)') {
                document.documentElement.style.setProperty('--mobile-nav-toggle-color', 'rgb(255, 255, 255)');
            }
        }
    });

    /* Flip color of mobile nav toggle on click if in light mode */
    select(".mobile-nav-toggle", true).forEach(element => {
        element.addEventListener('click', () => {
            if (toggleLightDarkButton.getAttribute('title') === "Enable Dark Mode") {
                const rootStyles = getComputedStyle(document.documentElement);
                const currentColor = rootStyles.getPropertyValue('--mobile-nav-toggle-color').trim();
            if (currentColor === 'rgb(255, 255, 255)') {
                document.documentElement.style.setProperty('--mobile-nav-toggle-color', 'rgb(0, 0, 0)');
            } else if (currentColor === 'rgb(0, 0, 0)') {
                document.documentElement.style.setProperty('--mobile-nav-toggle-color', 'rgb(255, 255, 255)');
            }
        }
    })});

    document.addEventListener('DOMContentLoaded', function () {
        const windowDiv = select('.window-div');
        const windowBar = select('.window-bar');
        const redButton = select('.window-button.red');
        const yellowButton = select('.window-button.yellow');
        const greenButton = select('.window-button.green');
        const shellInABox = select('.shell-in-a-box');
        const personalInformation = windowDiv.querySelector('.discord-about-me');
        
        let isMinimized = false; // Flag to track minimized state
        let isMaximized = false; // Flag to track maximized state
        let originalStyle = {}; // Store original styles for restore

        redButton.addEventListener('click', function () {
            originalStyle = {
                display: windowDiv.style.display,
                position: windowDiv.style.position,
                top: windowDiv.style.top,
                left: windowDiv.style.left,
                width: windowDiv.style.width,
                height: windowDiv.style.height,
                margin: windowDiv.style.margin,
                borderRadius: windowDiv.style.borderRadius,
                zIndex: windowDiv.style.zIndex,
                paddingBottom: windowDiv.querySelector('h1').style.paddingBottom,
                pDisplay: windowDiv.querySelector('p').style.display,
                shellInABoxDisplay: shellInABox.style.display,
                personalInformationDisplay: personalInformation.style.display
            };
            windowDiv.style.display = 'none';
        });

        yellowButton.addEventListener('click', function () {
            if (isMinimized) {
                // Restore to original state
                windowDiv.style.height = 'auto';
                windowDiv.style.alignSelf = 'flex-start';
                windowDiv.style.minHeight = '';
                windowDiv.style.maxHeight = '';
                personalInformation.style.display = 'block';
                isMinimized = false;
                windowDiv.style.height = 'auto'; 
            } else {
                // Minimize
                if (isMaximized) {return;}
                windowDiv.style.height = 'auto'; 
                windowDiv.style.alignSelf = 'flex-start';
                windowDiv.style.minHeight = '';
                windowDiv.style.maxHeight = '';
                personalInformation.style.display = 'none';
                isMinimized = true;
            }
        });

        greenButton.addEventListener('click', function () {
            const windowBodyWrapper = select('#window-body-wrapper');
            const curiousSection = select('#curious-section');

            if (isMaximized) {
                // Restore to original size
                windowDiv.style.position = originalStyle.position || 'relative';
                windowDiv.style.top = originalStyle.top || '';
                windowDiv.style.left = originalStyle.left || '';
                windowDiv.style.width = originalStyle.width || '400px';
                windowDiv.style.marginBottom = '-120px';
                windowDiv.style.height = 'auto'; 
                windowDiv.style.margin = '';
                windowDiv.style.alignSelf = 'flex-start';
                windowDiv.style.minHeight = '';
                windowDiv.style.maxHeight = '';
                windowDiv.style.borderRadius = originalStyle.borderRadius || '15px';
                windowBar.style.borderRadius = originalStyle.borderRadius || '15px 15px 0 0';
                windowDiv.style.zIndex = originalStyle.zIndex || '';

                // Restore layout
                if (windowBodyWrapper) {
                    windowBodyWrapper.style.display = 'block';
                    windowBodyWrapper.style.height = 'auto';
                }
                if (curiousSection) {
                    curiousSection.style.width = '100%';
                    curiousSection.style.height = 'auto';
                    curiousSection.style.overflowY = 'visible';
                }
                shellInABox.style.width = '100%';
                shellInABox.style.height = 'auto';

                isMaximized = false;
            } else {
                // Maximize
                if (isMinimized) {return;}
                windowDiv.style.position = 'fixed';
                windowDiv.style.top = '0';
                windowDiv.style.left = '0';
                windowDiv.style.width = '100%';
                windowDiv.style.height = '100%';
                windowDiv.style.margin = '0';
                windowDiv.style.alignSelf = '';
                windowDiv.style.minHeight = '';
                windowDiv.style.maxHeight = '';
                windowDiv.style.borderRadius = '0';
                windowBar.style.borderRadius = '0';
                windowDiv.style.zIndex = '9999';

                if (windowBodyWrapper) {
                    windowBodyWrapper.style.display = 'flex';
                    windowBodyWrapper.style.height = 'calc(100% - 40px)'; 
                }
                if (curiousSection) {
                    curiousSection.style.width = '50%';
                    curiousSection.style.height = '100%';
                    curiousSection.style.overflowY = 'auto';
                }
                shellInABox.style.width = '50%';
                shellInABox.style.height = '95%';

                isMaximized = true;
            }
            const profileCard = document.querySelector('#dc-profile-card');
            if (profileCard) profileCard.classList.toggle('dc-expanded', isMaximized);
            shellInABox.style.display = isMaximized ? 'block' : 'none'; 
        });
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

    window.applyTheme = function(isDark, playTone = false) {
        const white = 'rgb(253, 253, 230)';
        const black = 'rgb(0, 0, 0)';
        const fadedBlack = 'rgb(40, 39, 39)';
        const veryFadedBlack = 'rgb(0, 0, 0, 0.2)';
        const blue = 'rgb(4, 58, 116)';
        const headerBlue = 'rgb(203, 217, 230)';
        const iconBoxWhite = 'rgb(255, 255, 240, 0.7)';
        const hoverIconBoxWhite = 'rgb(240, 240, 231)';
        const footerBlue = 'rgb(215, 230, 226)';

        const fadedWhite = 'rgb(223, 223, 223)';
        const veryFadedWhite = 'rgb(255, 255, 255, 0.2)';
        const green = 'rgb(24, 210, 110)';
        const iconBoxBlack = 'rgba(255, 255, 255, 0.08)';
        const hoverIconBoxBlack = 'rgba(255, 255, 255, 0.12)';
        const footerGreen = 'rgb(32, 37, 29)';

        let newBgColor, newTextColor, newFadedColor, newVeryFadedColor, newHeaderColor, newHeaderBg, newIconBox, newHoverIconBox, newFooterColor;

        if (isDark) { // set to dark mode
            newBgColor = black;
            newTextColor = white;
            newFadedColor = fadedWhite;
            newVeryFadedColor = veryFadedWhite;
            newHeaderColor = green;
            newHeaderBg = black;
            newIconBox = iconBoxBlack;
            newHoverIconBox = hoverIconBoxBlack;
            newFooterColor = footerGreen;
            toggleLightDarkButton.setAttribute('title', 'Enable Light Mode');
            document.documentElement.style.setProperty('--dc-card-bg', '#232428');
            document.documentElement.style.setProperty('--dc-card-section-bg', '#2b2d31');
            document.documentElement.style.setProperty('--dc-card-text', '#f2f3f5');
            document.documentElement.style.setProperty('--dc-card-text-muted', '#b5bac1');
            document.documentElement.style.setProperty('--dc-card-divider', '#3a3b3e');
            document.documentElement.style.setProperty('--dc-avatar-border-color', '#232428');

            if (playTone && typeof Tone !== 'undefined') {
                Tone.start();
                if (!window.webSynth) {
                    window.webSynth = new Tone.PolySynth(Tone.Synth).toDestination();
                    window.webSynth.volume.value = -12;
                }
                const now = Tone.now();
                ["B2", "Gb3", "B3"].forEach((note, i) => {
                    window.webSynth.triggerAttackRelease(note, "8n", now + i * 0.2);
                });
            }
            
            select('#home').setAttribute('data-pitch', 'B3');
            // select('#navProjects').setAttribute('data-pitch', 'Eb4');
            select('#navMusic').setAttribute('data-pitch', 'Eb4');
            select('a[href="https://home.iancheung.dev"]')?.setAttribute('data-pitch', 'Gb4');
            select('a[href="resume.pdf"]')?.setAttribute('data-pitch', 'B4');
            // IDE dark theme
            document.documentElement.style.setProperty('--ide-bg', '#1e1e1e');
            document.documentElement.style.setProperty('--ide-sidebar-bg', '#252526');
            document.documentElement.style.setProperty('--ide-border', '#474747');
            document.documentElement.style.setProperty('--ide-border-inner', '#3c3c3c');
            document.documentElement.style.setProperty('--ide-tab-bg', '#2d2d2d');
            document.documentElement.style.setProperty('--ide-tab-active-bg', '#1e1e1e');
            document.documentElement.style.setProperty('--ide-tab-text', '#969696');
            document.documentElement.style.setProperty('--ide-tab-active-text', '#ffffff');
            document.documentElement.style.setProperty('--ide-tab-hover-bg', '#292929');
            document.documentElement.style.setProperty('--ide-tab-hover-text', '#cccccc');
            document.documentElement.style.setProperty('--ide-item-hover-bg', '#2a2d2e');
            document.documentElement.style.setProperty('--ide-file-active-bg', '#094771');
            document.documentElement.style.setProperty('--ide-file-text', '#cccccc');
            document.documentElement.style.setProperty('--ide-sidebar-title-text', '#bbbbbb');
            document.documentElement.style.setProperty('--ide-scrollbar-thumb', '#424242');
            document.documentElement.style.setProperty('--ide-scrollbar-track', '#1e1e1e');
            document.documentElement.style.setProperty('--ide-img-bg', '#1a1a1a');
            document.documentElement.style.setProperty('--ide-card-bg', '#252526');
            document.documentElement.style.setProperty('--ide-text', '#ffffff');
            document.documentElement.style.setProperty('--ide-text-muted', '#cccccc');
            document.documentElement.style.setProperty('--ide-subtitle-text', '#858585');
            document.documentElement.style.setProperty('--ide-linenum-text', '#5a5a5a');
            document.documentElement.style.setProperty('--ide-link-text', '#3794ff');
            document.documentElement.style.setProperty('--ide-link-hover', '#60a9ff');
            document.documentElement.style.setProperty('--ide-shadow', 'rgba(0,0,0,0.5)');
        } else { // set to light mode
            newBgColor = white;
            newTextColor = black;
            newFadedColor = fadedBlack;
            newVeryFadedColor = veryFadedBlack;
            newHeaderColor = blue;
            newHeaderBg = headerBlue;
            newIconBox = iconBoxWhite;
            newHoverIconBox = hoverIconBoxWhite;
            newFooterColor = footerBlue;
            toggleLightDarkButton.setAttribute('title', 'Enable Dark Mode');
            document.documentElement.style.setProperty('--dc-card-bg', '#f2f3f5');
            document.documentElement.style.setProperty('--dc-card-section-bg', '#e3e5e8');
            document.documentElement.style.setProperty('--dc-card-text', '#2e3035');
            document.documentElement.style.setProperty('--dc-card-text-muted', '#5c5f66');
            document.documentElement.style.setProperty('--dc-card-divider', '#d4d5d7');
            document.documentElement.style.setProperty('--dc-avatar-border-color', '#f2f3f5');

            if (playTone && typeof Tone !== 'undefined') {
                Tone.start();
                if (!window.webSynth) {
                    window.webSynth = new Tone.PolySynth(Tone.Synth).toDestination();
                    window.webSynth.volume.value = -12;
                }
                const now = Tone.now();
                ["C3", "G3", "C4"].forEach((note, i) => {
                    window.webSynth.triggerAttackRelease(note, "8n", now + i * 0.2);
                });
            }
            
            select('#home').setAttribute('data-pitch', 'C4');
            // select('#navProjects').setAttribute('data-pitch', 'E4');
            select('#navMusic').setAttribute('data-pitch', 'E4');
            select('a[href="https://home.iancheung.dev"]')?.setAttribute('data-pitch', 'G4');
            select('a[href="resume.pdf"]')?.setAttribute('data-pitch', 'C5');
            // IDE light theme
            document.documentElement.style.setProperty('--ide-bg', '#ffffff');
            document.documentElement.style.setProperty('--ide-sidebar-bg', '#f3f3f3');
            document.documentElement.style.setProperty('--ide-border', '#e7e7e7');
            document.documentElement.style.setProperty('--ide-border-inner', '#e0e0e0');
            document.documentElement.style.setProperty('--ide-tab-bg', '#ececec');
            document.documentElement.style.setProperty('--ide-tab-active-bg', '#ffffff');
            document.documentElement.style.setProperty('--ide-tab-text', '#8e8e8e');
            document.documentElement.style.setProperty('--ide-tab-active-text', '#333333');
            document.documentElement.style.setProperty('--ide-tab-hover-bg', '#e0e0e0');
            document.documentElement.style.setProperty('--ide-tab-hover-text', '#333333');
            document.documentElement.style.setProperty('--ide-item-hover-bg', '#e5e5e5');
            document.documentElement.style.setProperty('--ide-file-active-bg', '#0060c0');
            document.documentElement.style.setProperty('--ide-file-text', '#333333');
            document.documentElement.style.setProperty('--ide-sidebar-title-text', '#6f6f6f');
            document.documentElement.style.setProperty('--ide-scrollbar-thumb', '#c2c2c2');
            document.documentElement.style.setProperty('--ide-scrollbar-track', '#f5f5f5');
            document.documentElement.style.setProperty('--ide-img-bg', '#e8e8e8');
            document.documentElement.style.setProperty('--ide-card-bg', '#f5f5f5');
            document.documentElement.style.setProperty('--ide-text', '#1a1a1a');
            document.documentElement.style.setProperty('--ide-text-muted', '#555555');
            document.documentElement.style.setProperty('--ide-subtitle-text', '#777777');
            document.documentElement.style.setProperty('--ide-linenum-text', '#999999');
            document.documentElement.style.setProperty('--ide-link-text', '#0066cc');
            document.documentElement.style.setProperty('--ide-link-hover', '#004499');
            document.documentElement.style.setProperty('--ide-shadow', 'rgba(0,0,0,0.15)');
        }

        document.documentElement.style.setProperty('--background-color', newBgColor);
        document.documentElement.style.setProperty('--text-color', newTextColor);
        document.documentElement.style.setProperty('--fade-text-color', newFadedColor);
        document.documentElement.style.setProperty('--very-fade-text-color', newVeryFadedColor);
        document.documentElement.style.setProperty('--header-text-color', newHeaderColor);
        document.documentElement.style.setProperty('--header-background-color', newHeaderBg);
        document.documentElement.style.setProperty('--icon-box', newIconBox);
        document.documentElement.style.setProperty('--hover-icon-box', newHoverIconBox);
        document.documentElement.style.setProperty('--footer-background-color', newFooterColor);
        
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
     * Initialize mobile nav toggle bar behaviour and button animation
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

    const navbar = document.getElementById('navbar');
    const mobileNavObserver = new MutationObserver(() => {
        console.log('Navbar class changed:', navbar.className);
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
     * Initalize YouTube playlist boxes
     */
    const YOUTUBE_API_KEY = 'AIzaSyB7CFUxCc-mPxPRWncGpwlrq20-j3_bbTk';

    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function parseDuration(iso) {
        const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!m) return '';
        const h = parseInt(m[1] || 0), min = parseInt(m[2] || 0), s = parseInt(m[3] || 0);
        if (h > 0) return `${h}:${String(min).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        return `${min}:${String(s).padStart(2,'0')}`;
    }

    function formatViews(count) {
        const n = parseInt(count);
        if (n >= 1000000) return `${+(n/1000000).toFixed(1)}M views`;
        if (n >= 1000) return `${+(n/1000).toFixed(1)}K views`;
        return `${n} views`;
    }

    function timeAgoString(dateStr) {
        const diff = Date.now() - new Date(dateStr).getTime();
        const d = Math.floor(diff / 86400000);
        if (d >= 365) { const y = Math.floor(d/365); return `${y} year${y>1?'s':''} ago`; }
        if (d >= 30)  { const mo = Math.floor(d/30);  return `${mo} month${mo>1?'s':''} ago`; }
        if (d >= 1)   return `${d} day${d>1?'s':''} ago`;
        const h = Math.floor(diff / 3600000);
        if (h >= 1)   return `${h} hour${h>1?'s':''} ago`;
        const min = Math.floor(diff / 60000);
        return min >= 1 ? `${min} minute${min>1?'s':''} ago` : 'Just now';
    }

    async function fetchChannelStats() {
        try {
            const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=UCMUa8dSkwbs4E22RxlFu34g&key=${YOUTUBE_API_KEY}`);
            if (!res.ok) return;
            const data = await res.json();
            const item = data.items?.[0];
            if (!item) return;
            const snippet = item.snippet || {};
            const stats   = item.statistics || {};

            const avatarEl = select('#yt-channel-avatar-img');
            if (avatarEl && snippet.thumbnails?.high?.url) {
                avatarEl.src = snippet.thumbnails.high.url;
            }

            const nameEl = select('#yt-channel-name-text');
            if (nameEl && snippet.title) {
                nameEl.textContent = snippet.title;
            }

            const handleEl = select('#yt-channel-handle-text');
            if (handleEl && snippet.customUrl) {
                handleEl.textContent = snippet.customUrl;
            }

            const vidEl = select('#yt-video-count');
            if (vidEl && stats.videoCount) vidEl.textContent = stats.videoCount + ' videos';

            const subCounter = select('#yt-sub-purecounter');
            if (subCounter && stats.subscriberCount) {
                const count = parseInt(stats.subscriberCount);
                subCounter.setAttribute('data-purecounter-end', count);
                subCounter.textContent = count;
                new PureCounter();
            }
        } catch (e) {
            console.error('Channel stats error:', e);
        }
    }

    async function loadPlaylist(container) {
        const playlistId = container.dataset.playlist;
        try {
            const items = [];
            let pageToken = '';
            do {
                const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&key=${YOUTUBE_API_KEY}&maxResults=50${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error('Playlist API error');
                const data = await res.json();
                items.push(...(data.items || []));
                pageToken = data.nextPageToken || '';
            } while (pageToken);

            if (!items.length) {
                container.innerHTML = '<div class="col-12 text-muted py-3">No videos found.</div>';
                return;
            }

            const videoIds = items.map(i => i.snippet?.resourceId?.videoId).filter(Boolean);
            const details = {};
            for (let i = 0; i < videoIds.length; i += 50) {
                const batch = videoIds.slice(i, i + 50).join(',');
                const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${batch}&key=${YOUTUBE_API_KEY}`);
                if (res.ok) {
                    const data = await res.json();
                    (data.items || []).forEach(v => {
                        details[v.id] = { duration: v.contentDetails?.duration, viewCount: v.statistics?.viewCount };
                    });
                }
            }

            container.innerHTML = items.map(item => {
                const videoId = item.snippet?.resourceId?.videoId;
                if (!videoId) return '';
                const title    = escapeHtml(item.snippet.title || '');
                const thumb    = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
                const detail   = details[videoId] || {};
                const duration = detail.duration  ? parseDuration(detail.duration)  : '';
                const views    = detail.viewCount ? formatViews(detail.viewCount)   : '';
                const ago      = item.snippet.publishedAt ? timeAgoString(item.snippet.publishedAt) : '';
                const meta     = [views, ago].filter(Boolean).join(' · ');
                return `
                <div class="col">
                    <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank" rel="noopener noreferrer" class="yt-video-link">
                        <div class="yt-thumb-wrap">
                            <img src="${thumb}" class="yt-thumb" alt="${title}" loading="lazy">
                            ${duration ? `<span class="yt-duration">${duration}</span>` : ''}
                        </div>
                        <div class="mt-2">
                            <p class="yt-video-title mb-1">${title}</p>
                            ${meta ? `<p class="yt-video-meta mb-0">${meta}</p>` : ''}
                        </div>
                    </a>
                </div>`;
            }).join('');
        } catch (e) {
            console.error(e);
            container.innerHTML = '<div class="col-12 text-muted py-3">Could not load videos. Please try again later.</div>';
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        fetchChannelStats();
        select('.playlist-videos', true).forEach(container => {
            const playlistObserver = new IntersectionObserver((entries, obs) => {
                if (entries[0].isIntersecting) {
                    loadPlaylist(container);
                    obs.disconnect();
                }
            }, { rootMargin: '100px' });
            playlistObserver.observe(container);
        });
    });


    /**
     * Initialize Medium posts section
     */
    async function loadMediumPosts() {
        const container = select('#medium-posts-container');
        if (!container) return;
        try {
            const response = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/@iancheung0202');
            const data = await response.json();
            if (data.status !== 'ok' || !data.items) {
                throw new Error('Failed to fetch Medium posts');
            }
            container.innerHTML = data.items.map(item => {
                const title = item.title;
                const link = item.link;
                let description = item.description.replace(/<[^>]*>/g, '').substring(0, 200) + '...';
                description = description.replace(/abstract/gi, ''); // Remove 'abstract' from description if present
                const pubDate = new Date(item.pubDate).toLocaleDateString();

                return `
                    <div class="col-lg-4 col-md-6 d-flex align-items-stretch project-box">
                        <a href="${link}" target="_blank">
                                <h3>${title}</h3>
                                <div style="background: var(--background-color); border-radius: 8px; padding: 4px 8px; margin: 8px 0; border: 1px solid var(--fade-text-color); display: inline-block; font-size: small; color: var(--fade-text-color) !important;">Published on ${pubDate}</div>
                                <small><i><p style="text-align: justify; color: var(--fade-text-color) !important;">${description}</p></i></small>
                        
                        </a>
                    </div>
                `;
            }).join('');
        } catch (e) {
            console.error(e);
            container.innerHTML = `<p>Failed to load Medium posts: ${e.message}</p>`;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const mediumContainer = select('#medium-posts-container');
        if (mediumContainer) {
            const mediumObserver = new IntersectionObserver((entries, obs) => {
                if (entries[0].isIntersecting) {
                    loadMediumPosts();
                    obs.disconnect();
                }
            }, { rootMargin: '200px' });
            mediumObserver.observe(mediumContainer);
        }
    });


    /**
     * Initialize terminal and embedded browser functionality
     */
    document.addEventListener('DOMContentLoaded', () => {
        const input = select('#terminal-input');
        const output = select('#terminal-output');
        const container = select('#terminal-container');
        const promptSpan = select('#terminal-prompt');
        const terminalWrapper = select('#terminal-wrapper');
        const greenButton = select('.window-button.green');
        const credits = select('.credits')

        const iframe = select('#browser-iframe');
        const addressBar = select('#browser-address-bar');
        const tabTitle = select('#browser-tab-title');

        const backBtn = select('#browser-back-btn');
        const forwardBtn = select('#browser-forward-btn');

        let historyStack = ['https://ssh.iancheung.dev/'];
        let currentIndex = 0;
        let isNavigatingHistory = false;

        function updateButtons() {
            if (backBtn) backBtn.style.opacity = currentIndex > 0 ? '1' : '0.3';
            if (forwardBtn) forwardBtn.style.opacity = currentIndex < historyStack.length - 1 ? '1' : '0.3';
        }

        function navigateTo(url) {
            iframe.src = url;
            addressBar.value = url;
        }

        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (currentIndex > 0) {
                    currentIndex--;
                    isNavigatingHistory = true;
                    navigateTo(historyStack[currentIndex]);
                    updateButtons();
                }
            });
        }

        if (forwardBtn) {
            forwardBtn.addEventListener('click', () => {
                if (currentIndex < historyStack.length - 1) {
                    currentIndex++;
                    isNavigatingHistory = true;
                    navigateTo(historyStack[currentIndex]);
                    updateButtons();
                }
            });
        }

        if (addressBar) {
            addressBar.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    let url = this.value;
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                        url = 'https://' + url;
                    }
                    
                    if (currentIndex < historyStack.length - 1) {
                        historyStack = historyStack.slice(0, currentIndex + 1);
                    }
                    
                    historyStack.push(url);
                    currentIndex++;
                    
                    iframe.src = url;
                    this.value = url;
                    updateButtons();
                }
            });
        }

        if (iframe) {
            iframe.addEventListener('load', function() {
                try {
                    const title = iframe.contentDocument.title;
                    if (title && tabTitle) {
                        tabTitle.textContent = title;
                    }
                    
                    const currentUrl = iframe.contentWindow.location.href;
                    
                    if (currentUrl !== 'about:blank' && currentUrl !== historyStack[currentIndex]) {
                        if (!isNavigatingHistory) {
                            if (currentIndex < historyStack.length - 1) {
                                historyStack = historyStack.slice(0, currentIndex + 1);
                            }
                            historyStack.push(currentUrl);
                            currentIndex++;
                        }
                        addressBar.value = currentUrl;
                        updateButtons();
                    }
                    isNavigatingHistory = false;

                } catch (e) {
                    console.log('Cannot access iframe content due to same-origin policy');
                    isNavigatingHistory = false;
                }
            });
        }
        
        updateButtons();

        if (iframe && addressBar) {
            iframe.src = addressBar.value;
        }

        if (greenButton && terminalWrapper && credits) {
            greenButton.addEventListener('click', () => {
                const windowDiv = select('.window-div');
                if (windowDiv.style.position === 'fixed') {
                    terminalWrapper.style.display = 'block';
                    credits.style.display = 'none';
                } else {
                    terminalWrapper.style.display = 'none';
                    credits.style.display = 'block';
                }
            });
        }

        if (!input || !output || !container) return;

        let pythonMode = false;
        let userIP = '127.0.0.1';

        const formatIPForPrompt = (ip) => ip.replace(/\./g, '-');
        
        const getPromptHtml = (ip) => {
            return `<span style="color: #dcdcaa;">guest@iancheung.dev${ip !== '127.0.0.1' ? '-' + formatIPForPrompt(ip) : ''}</span>:<span style="color: #4ec9b0;">~</span>$`;
        };

        fetch('https://api.ipify.org?format=json')
            .then(res => res.json())
            .then(data => {
                userIP = data.ip;
                if (promptSpan && !pythonMode) promptSpan.innerHTML = getPromptHtml(userIP);
            })
            .catch(err => console.error('Failed to fetch IP:', err));

        const commands = {
            help: "Available commands: help, clear, about, projects, contact, echo, date, whoami, ip, python3",
            about: "I'm Ian, a full-stack developer, data engineer, and social media manager.",
            projects: 'Check out my projects on <a href="https://github.com/iancheung0202" target="_blank">GitHub</a>!',
            contact: '<a href="mailto:ian@iancheung.dev" class="email"><i class="bi bi-envelope-fill"></i> </a> <a href="https://www.linkedin.com/in/iancheung0202" class="linkedin" target="_blank"> <i class="bi bi-linkedin"></i> </a> <a href="https://instagram.com/iancheung0202" class="instagram" target="_blank"> <i class="bi bi-instagram"></i> </a> <a href="https://discord.com/users/692254240290242601" class="discord" target="_blank"> <i class="bi bi-discord"></i> </a> <a href="https://www.youtube.com/channel/UCMUa8dSkwbs4E22RxlFu34g/" class="youtube" target="_blank"> <i class="bi bi-youtube"></i> </a> <a href="https://github.com/iancheung0202" class="github" target="_blank"> <i class="bi bi-github"></i> </a> <a href="https://www.strava.com/athletes/126909167" class="strava" target="_blank"> <i class="bi bi-strava"></i> </a> <!-- <a href="https://www.medium.com/@iancheung0202" class="medium" target="_blank"> <i class="bi bi-medium"></i> </a> -->',
            clear: () => { output.innerHTML = ''; },
            date: () => new Date().toString(),
            whoami: () => {
                return `Your Device Specifications:<br>User Agent: ${navigator.userAgent}<br>Platform: ${navigator.platform}<br>Language: ${navigator.language}`;
            },
            ip: () => {
                return `Your IP Address: ${userIP}`;
            },
            echo: (args) => args.join(' ')
        };

        let pyodide = null;
        let pyodideReady = false;

        async function initPyodide() {
            if (pyodideReady) return;
            const loadingDiv = document.createElement('div');
            loadingDiv.textContent = "Loading Python environment... (this may take a moment)";
            loadingDiv.style.color = '#d4d4d4';
            output.appendChild(loadingDiv);
            
            try {
                if (typeof loadPyodide === 'undefined') {
                    await new Promise((resolve, reject) => {
                        const s = document.createElement('script');
                        s.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
                        s.onload = resolve;
                        s.onerror = () => reject(new Error('Failed to load Pyodide'));
                        document.head.appendChild(s);
                    });
                }
                pyodide = await loadPyodide();
                pyodide.setStdout({ batched: (msg) => {
                    const respDiv = document.createElement('div');
                    respDiv.textContent = msg;
                    respDiv.style.color = '#d4d4d4';
                    respDiv.style.whiteSpace = 'pre-wrap';
                    output.appendChild(respDiv);
                }});

                await pyodide.runPythonAsync(`
    import js
    import builtins
    import os

    def custom_input(prompt=""):
        if prompt and "help" in str(prompt):
            return ""
        val = js.prompt(prompt)
        return val if val is not None else ""

    builtins.input = custom_input
    os.environ['PAGER'] = 'cat'
                `);

                pyodideReady = true;
                loadingDiv.remove();
                
                const startDiv = document.createElement('div');
                startDiv.textContent = `Python 3.11.3 (main, May 23 2023, 15:51:15) [Clang 14.0.6 ] on webassembly\nType "help", "copyright", "credits" or "license" for more information.`;
                startDiv.style.color = '#d4d4d4';
                startDiv.style.whiteSpace = 'pre-wrap';
                output.appendChild(startDiv);
                
                pythonMode = true;
                if (promptSpan) promptSpan.innerHTML = '<span style="color: #dcdcaa;">>>> </span>';
            } catch (err) {
                loadingDiv.textContent = "Failed to load Python environment: " + err;
                loadingDiv.style.color = '#f44747';
                pythonMode = false;
            }
        }

        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const commandLine = input.textContent.trim();
                input.textContent = '';
                
                if (!commandLine && !pythonMode) return;

                const cmdDiv = document.createElement('div');
                if (pythonMode) {
                    cmdDiv.innerHTML = `<span style="color: #dcdcaa;">>>> </span>${commandLine}`;
                } else {
                    cmdDiv.innerHTML = `${getPromptHtml(userIP)} ${commandLine}`;
                }
                output.appendChild(cmdDiv);
                container.scrollTop = container.scrollHeight;

                if (pythonMode) {
                    if (commandLine === 'exit()' || commandLine === 'quit()') {
                        pythonMode = false;
                        if (promptSpan) promptSpan.innerHTML = getPromptHtml(userIP);
                    } else {
                        if (!pyodideReady) {
                            const errDiv = document.createElement('div');
                            errDiv.textContent = "Python is still loading...";
                            errDiv.style.color = '#f44747';
                            output.appendChild(errDiv);
                        } else {
                            try {
                                let result = await pyodide.runPythonAsync(commandLine);
                                if (result !== undefined && result !== null) {
                                    const respDiv = document.createElement('div');
                                    respDiv.textContent = result.toString();
                                    respDiv.style.color = '#d4d4d4';
                                    respDiv.style.whiteSpace = 'pre-wrap';
                                    output.appendChild(respDiv);
                                }
                            } catch (err) {
                                const errDiv = document.createElement('div');
                                errDiv.textContent = err.toString();
                                errDiv.style.color = '#f44747';
                                errDiv.style.whiteSpace = 'pre-wrap';
                                output.appendChild(errDiv);
                            }
                        }
                    }
                } else {
                    const args = commandLine.split(' ');
                    const cmd = args.shift().toLowerCase();

                    if (cmd === 'python3') {
                        if (!pyodideReady) {
                            await initPyodide();
                        } else {
                            pythonMode = true;
                            if (promptSpan) promptSpan.innerHTML = '<span style="color: #dcdcaa;">>>> </span>';
                            const startDiv = document.createElement('div');
                            startDiv.textContent = `Python 3.11.3 (main, May 23 2023, 15:51:15) [Clang 14.0.6 ] on webassembly\nType "help", "copyright", "credits" or "license" for more information.`;
                            startDiv.style.color = '#d4d4d4';
                            startDiv.style.whiteSpace = 'pre-wrap';
                            output.appendChild(startDiv);
                        }
                    } else if (commands[cmd]) {
                        const response = typeof commands[cmd] === 'function' ? commands[cmd](args) : commands[cmd];
                        if (response) {
                            const respDiv = document.createElement('div');
                            respDiv.innerHTML = response; // Use innerHTML to render HTML tags like <br>
                            respDiv.style.setProperty('color', '#d4d4d4', 'important');
                            respDiv.style.whiteSpace = 'pre-wrap';
                            const links = respDiv.querySelectorAll('a');
                            links.forEach(link => {
                                link.style.setProperty('color', '#d4d4d4', 'important');
                            });

                            output.appendChild(respDiv);
                        }
                    } else {
                        const errDiv = document.createElement('div');
                        errDiv.textContent = `Command not found: ${cmd}`;
                        errDiv.style.color = '#f44747';
                        output.appendChild(errDiv);
                    }
                }

                container.scrollTop = container.scrollHeight;
            }
        });
    });

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