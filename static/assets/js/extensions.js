/* RANDOMLY SELECT AND DISPLAY HEADER BACKGROUND IMAGE */

// ls *.jpg *.jpeg *.png 2>/dev/null | sed -e 's/^/"/' -e 's/$/",/' | sed '$s/,$//' | (echo '[' && cat - && echo ']') > manifest.json
(function() {
    var bgPath = 'assets/img/bg/';
    fetch(bgPath + 'manifest.json', {cache: 'no-store'}).then(function(resp) {
        if (!resp.ok) return;
        return resp.json();
    }).then(function(list) {
        if (!Array.isArray(list) || !list.length) return;
        var idx = Math.floor(Math.random() * list.length);
        var filename = list[idx];
        var url = bgPath + encodeURIComponent(filename);
        console.log('Selected header background image:', filename);
        var header = document.getElementById('header');
        if (header) header.style.backgroundImage = "linear-gradient(rgba(0,0,0,0.7),rgba(0,0,0,0.7)),url('" + url + "')";
        var filenameElem = document.getElementById('photo-filename');
        if (filenameElem) filenameElem.textContent = filename.replace(/\.[^/.]+$/, "");
    });
})();

/* FETCH AND DISPLAY DISCORD ACTIVITY */

let activityStartTimes = [];
async function fetchDiscordActivity() {
    const feed = document.getElementById('discord-activity-feed');
    try {
        const res = await fetch('https://activity.fischl.app');
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        if (!data.activity || !Array.isArray(data.activity) || data.activity.length === 0) {
                feed.innerHTML = `
                <div style="background:var(--background-color);border-radius:12px;padding:14px 18px;margin-bottom:14px;box-shadow:0 2px 12px #0001;border:1px solid var(--fade-text-color);display:flex;align-items:center;">
                    <div style="margin-right:12px;display:flex;align-items:center;justify-content:center;width:40px;height:40px;">
                        <i class="bi bi-activity" style="font-size:1.5em;color:#888;"></i>
                    </div>
                    <div style="flex:1;min-width:0;">
                        <span style="font-weight:600;font-family:'Poppins',sans-serif;color:var(--fade-text-color);font-size:1.1em;">No Discord activity found</span><br>
                        <span style="color:#b0b0b0;font-size:small;">I'm probably offline or AFK on Discord. Check back soon for live updates!</span>
                    </div>
                </div>`;
        return;
        }
        activityStartTimes = data.activity.map(act => act.timestamps && act.timestamps.start ? parseInt(act.timestamps.start, 10) : null);
        feed.innerHTML = data.activity.map((a, i) => renderActivity(a, i)).join('');
        updateActivityTimers();
    } catch (e) {
        feed.innerHTML = '<div style="color:#e74c3c">Failed to load Discord status.</div>';
        console.error(e);
    }
}

function renderActivity(act, idx) {
    let icon = '';
    if (act.emoji && act.emoji.name) {
        // Custom Discord emoji (static or animated)
        if (act.emoji.id) {
            const ext = (act.emoji.animated === true || act.emoji.animated === 'True' || act.emoji.animated === 'true') ? 'gif' : 'png';
            icon = `<img src="https://cdn.discordapp.com/emojis/${act.emoji.id}.${ext}" alt="${act.emoji.name}" style="width:40px;height:40px;border-radius:8px;vertical-align:middle;margin-right:12px;box-shadow:0 2px 8px #0002;${act.emoji.animated ? 'image-rendering:auto;' : ''}">`;
        } else {
            // Unicode emoji fallback
            icon = `<span style="font-size:1.5em;vertical-align:middle;">${act.emoji.name}</span>`;
        }
    } else if (act.name === 'Spotify' && act.assets && act.assets.large_image) {
        // Spotify album art
        const img = act.assets.large_image.startsWith('spotify:')
        ? `https://i.scdn.co/image/${act.assets.large_image.replace('spotify:', '')}`
        : act.assets.large_image;
        icon = `<img src="${img}" style="width:40px;height:40px;border-radius:8px;vertical-align:middle;margin-right:12px;box-shadow:0 2px 8px #0002;">`;
    } else if (act.assets && act.assets.large_image) {
        // Generic large image
        icon = `<img src="https://cdn.discordapp.com/app-assets/${act.application_id}/${act.assets.large_image}.png" style="width:40px;height:40px;border-radius:8px;vertical-align:middle;margin-right:12px;box-shadow:0 2px 8px #0002;">`;
    } else {
        icon = `<i class="bi bi-activity" style="font-size:1.5em;vertical-align:middle;margin-right:12px;color:#1e90ff;"></i>`;
    }

    let main = `<span style="font-weight:600;font-family:'Poppins',sans-serif;color:#1e2330;">${act.name || 'Unknown Activity'}</span>`;
    if (act.details) main += ` <br><span style="color:#4b5c6b; font-size:small; line-height:0.7;">${act.details}</span>`;
    if (act.state) main += `<br><span style="color:#6c757d; font-size:small; line-height:0.7;">${act.state}</span>`;

    let timer = '';
    if (act.timestamps && act.timestamps.start) {
        timer = `<div style=\"width:100%;display:flex;justify-content:flex-end;\">\n<span class=\"activity-timer\" data-idx=\"${idx}\" style=\"font-family:monospace;color:#27ae60;font-size:smaller;\">00:00:00</span>\n</div>`;
    }

    return `<div style="background:var(--background-color);border-radius:12px;padding:14px 18px;margin-bottom:14px;box-shadow:0 2px 12px #0001;border:1px solid var(--fade-text-color);display:flex;align-items:center;">
        <div style="margin-right:12px;">${icon}</div>
        <div style="flex:1;min-width:0;">${main}${timer}</div>
    </div>`;
}

fetchDiscordActivity();
setInterval(fetchDiscordActivity, 10000);

function updateActivityTimers() {
    const now = Date.now();
    document.querySelectorAll('.activity-timer').forEach(el => {
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

/* WINDOW-DIV DISPLAY ADJUSTMENTS */

windowDiv = document.querySelector(".window-div");

function adjustHeightAndMargin() {
    windowDiv.style.height = 'auto';  // Only adjust margin, never set height
    const lastChild = windowDiv.lastElementChild;
    if (lastChild) {lastChild.style.marginBottom = '30px';}
}

const toggleLightDarkButton = document.getElementById('toggle-button');

document.querySelectorAll('.page').forEach(button => {
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

document.getElementById("home").addEventListener("click", () => {
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
document.querySelectorAll(".mobile-nav-toggle").forEach(element => {
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

function adjustMargin() {
    // Find the last child element of window-div
    const lastChild = windowDiv.lastElementChild;
    
    // Set a margin-bottom of 30px to the last child
    if (lastChild) {
        lastChild.style.marginBottom = '30px';
    }
}

adjustMargin();

// Adjust the margin if content dynamically changes
const observer = new MutationObserver(adjustMargin);
observer.observe(windowDiv, { childList: true, subtree: true, characterData: true });

document.addEventListener('DOMContentLoaded', function () {
    const windowDiv = document.querySelector('.window-div');
    const windowBar = document.querySelector('.window-bar');
    const redButton = document.querySelector('.window-button.red');
    const yellowButton = document.querySelector('.window-button.yellow');
    const greenButton = document.querySelector('.window-button.green');
    const aboutMe = document.querySelector('.about-me-paragraph');
    const personalInformation = windowDiv.querySelector('.about-me');
    
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
            aboutMeDisplay: aboutMe.style.display,
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
            windowDiv.querySelector('p').style.display = 'block';
            personalInformation.style.display = 'block';
            isMinimized = false;
            adjustHeightAndMargin();
        } else {
            // Minimize
            if (isMaximized) {return;}
            windowDiv.style.height = 'auto'; // Minimized height
            windowDiv.style.alignSelf = 'flex-start';
            windowDiv.style.minHeight = '';
            windowDiv.style.maxHeight = '';
            windowDiv.querySelector('p').style.display = 'none';
            windowDiv.querySelector('h1').style.paddingBottom = '0';
            personalInformation.style.display = 'none';
            isMinimized = true;
        }
    });

    greenButton.addEventListener('click', function () {
        const windowBodyWrapper = document.getElementById('window-body-wrapper');
        const curiousSection = document.getElementById('curious-section');

        if (isMaximized) {
            // Restore to original size
            windowDiv.style.position = originalStyle.position || 'relative';
            windowDiv.style.top = originalStyle.top || '';
            windowDiv.style.left = originalStyle.left || '';
            windowDiv.style.width = originalStyle.width || '400px';
            windowDiv.style.marginBottom = '-120px';
            windowDiv.style.height = 'auto'; // Always reset to auto
            windowDiv.style.margin = '';
            windowDiv.style.alignSelf = 'flex-start';
            windowDiv.style.minHeight = '';
            windowDiv.style.maxHeight = '';
            adjustMargin();
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
            aboutMe.style.width = '100%';
            aboutMe.style.height = 'auto';

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

            // Apply split layout
            if (windowBodyWrapper) {
                windowBodyWrapper.style.display = 'flex';
                windowBodyWrapper.style.height = 'calc(100% - 40px)'; // Adjust for window bar
            }
            if (curiousSection) {
                curiousSection.style.width = '50%';
                curiousSection.style.height = '100%';
                curiousSection.style.overflowY = 'auto';
            }
            aboutMe.style.width = '50%';
            aboutMe.style.height = '95%';

            isMaximized = true;
        }
        aboutMe.style.display = isMaximized ? 'block' : 'none'; // Show About me paragraph when maximized
    });
});

/* NERD MODE TOGGLE */

const nerd = document.getElementById("btn-code");
nerd.addEventListener("click", () => {
    if (button.classList.contains("a-active")) {
        document.getElementsByTagName("BODY")[0].style.fontFamily = "Open Sans";
        document.querySelectorAll(".subtitle").forEach(el => el.style.fontFamily = "Open Sans");
        button.classList.remove("a-active");
    } else {
        document.getElementsByTagName("BODY")[0].style.fontFamily = "monospace";
        document.querySelectorAll(".subtitle").forEach(el => el.style.fontFamily = "monospace");
        button.classList.add("a-active");
    }
    adjustHeightAndMargin();
});

/* AUDIO PLAYBACK WITH CONFETTI */

const audio = document.getElementById("audio");
const isChristmas = new Date().getMonth() === 11;
if (isChristmas) {
    audio.src = "assets/audio/Jingle Bells.mp3";
}
const button = document.getElementById("btn-play");
let isOut; // declare the variable to check
button.addEventListener("click", () => {
    if (button.classList.contains("a-active")) {
        audio.pause();
        button.classList.remove("a-active");
        // isOut = true;
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

/* DARK MODE TOGGLE */

toggleLightDarkButton.setAttribute('title', 'Enable Dark Mode');

toggleLightDarkButton.addEventListener('click', () => {
    const rootStyles = getComputedStyle(document.documentElement);

    const currentBgColor = rootStyles.getPropertyValue('--background-color').trim();
    
    const white = 'rgb(250, 250, 230)';
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
    const footerGreen = 'rgb(50, 67, 40)';

    if (currentBgColor == white) { // Currently light mode, set to dark mode
      // DARK
      newBgColor = black;
      newTextColor = white;
      newFadedColor = fadedWhite;
      newVeryFadedColor = veryFadedWhite;
      newHeaderColor = green;
      newHeaderBg = black;
      newIconBox = iconBoxBlack;
      newHoverIconBox = hoverIconBoxBlack;
      newFooterColor = footerGreen;
    //   newMobileNavColor = white;
      toggleLightDarkButton.setAttribute('title', 'Enable Light Mode');
    } else { // Currently dark mode, set to light mode
      newBgColor = white;
      newTextColor = black;
      newFadedColor = fadedBlack;
      newVeryFadedColor = veryFadedBlack;
      newHeaderColor = blue;
      newHeaderBg = headerBlue;
      newIconBox = iconBoxWhite;
      newHoverIconBox = hoverIconBoxWhite;
      newFooterColor = footerBlue;
    //   newMobileNavColor = black;
      toggleLightDarkButton.setAttribute('title', 'Enable Dark Mode');
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
    // document.documentElement.style.setProperty('--mobile-nav-toggle-color', newMobileNavColor);
    bootstrap.Tooltip.getInstance(toggleLightDarkButton).setContent({ '.tooltip-inner': toggleLightDarkButton.getAttribute('title') });
});

/* MOBILE NAVIGATION WOBBLE ANIMATION */

$(document).ready(function() {
    var $btn = $('#mobile-nav-toggle');
    function addClassAfterDelay() {
      setTimeout(function() {
        if (!$btn.hasClass('clicked')) {
          $btn.addClass('wobble');
        }
      }, 4000);
    }
    function removeClassOnClick() {
      $btn.removeClass('wobble').addClass('clicked');
      $btn.off('click', removeClassOnClick);
    }
    addClassAfterDelay();
    $btn.on('click', removeClassOnClick);
  });



/* FIX MOBILE NAV TO BE FULL SCREEN */

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
        navbar.style.paddingTop = '60px'; // Adjust for header height or something
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
console.log('Mobile nav observer set up.');


/* YOUTUBE PLAYLIST EMBED */
const YOUTUBE_API_KEY = 'AIzaSyB7CFUxCc-mPxPRWncGpwlrq20-j3_bbTk';

async function loadPlaylist(container) {
    const playlistId = container.dataset.playlist;
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&key=${YOUTUBE_API_KEY}&maxResults=50`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('API request failed');
        const data = await res.json();
        container.innerHTML = data.items.map(item => {
            const thumb = item.snippet.thumbnails && item.snippet.thumbnails.medium ? item.snippet.thumbnails.medium.url : (item.snippet.thumbnails && item.snippet.thumbnails.default ? item.snippet.thumbnails.default.url : '');
            const videoId = item.snippet.resourceId && item.snippet.resourceId.videoId ? item.snippet.resourceId.videoId : '';
            if (!thumb || !videoId) return '';
            return `
                <div class="col-lg-4 col-md-6 d-flex align-items-stretch" style="flex: 0 0 auto; width: 250px; margin-right: 10px !important; padding-bottom: -10px !important;">
                    <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank">
                        <div class="icon-box">
                            <img src="${thumb}" class="img-fluid project-img" alt="${item.snippet.title}">
                            <h6><b>${item.snippet.title}</b></h6>
                            <!-- Upload Date -->
                            <p style="font-size: small; color: var(--fade-text-color) !important;">Uploaded on ${new Date(item.snippet.publishedAt).toLocaleDateString()}</p>
                            <br><small><p style="color: var(--fade-text-color) !important;">Watch on &nbsp;<i class="bi bi-youtube" style="color: red !important;"></i> YouTube</p></small>
                        </div>
                    </a>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error(e);
        container.innerHTML = `<p>Failed to load playlist: ${e.message}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.playlist-videos').forEach(container => {
        loadPlaylist(container);
    });
});

/* LOAD MEDIUM POSTS */

async function loadMediumPosts() {
    const container = document.getElementById('medium-posts-container');
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
    loadMediumPosts();
});

/* TERMINAL INTERACTIVITY */

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('terminal-input');
    const output = document.getElementById('terminal-output');
    const container = document.getElementById('terminal-container');
    const promptSpan = document.getElementById('terminal-prompt');
    const terminalWrapper = document.getElementById('terminal-wrapper');
    const greenButton = document.querySelector('.window-button.green');
    const credits = document.querySelector('.credits')

    const iframe = document.getElementById('browser-iframe');
    const addressBar = document.getElementById('browser-address-bar');
    const tabTitle = document.getElementById('browser-tab-title');

    const backBtn = document.getElementById('browser-back-btn');
    const forwardBtn = document.getElementById('browser-forward-btn');

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

    // Force initial load to ensure content loads correctly
    if (iframe && addressBar) {
        iframe.src = addressBar.value;
    }

    // Toggle Visibility on Maximize/Minimize
    if (greenButton && terminalWrapper && credits) {
        greenButton.addEventListener('click', () => {
            const windowDiv = document.querySelector('.window-div');
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
        about: "I'm Ian, a full-stack developer, data scientist, and musician.",
        projects: "Check out my projects section <span style='color: #d4d4d4 !important; text-decoration: underline; cursor: pointer;' onclick='document.querySelector(\".window-button.green\").click(); document.getElementById(\"navCoding\").click();'>here</span>!",
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

