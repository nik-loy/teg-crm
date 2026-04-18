(function () {
    'use strict';

    // ── Onboarding reveal gate ────────────────────────────────────────
    // Suppress all theme backgrounds on cold load.
    // theme-dormant is removed on first Feed entry so themes fade in.
    var themeRevealed = localStorage.getItem('goodarts_theme_revealed') === '1';
    if (!themeRevealed) {
        document.body.classList.add('theme-dormant');
    }

    function revealTheme() {
        if (!document.body.classList.contains('theme-dormant')) return;
        document.body.classList.remove('theme-dormant');
        localStorage.setItem('goodarts_theme_revealed', '1');
    }

    // ── Dalí filter readiness ─────────────────────────────────────────
    // Set body.dali-filters-ready once the SVG filter element exists in DOM.
    // The SVG is injected inline in index.html (Task 4), so it's available
    // immediately after DOMContentLoaded.
    function checkDaliFilters() {
        if (document.getElementById('dali-warp')) {
            document.body.classList.add('dali-filters-ready');
        }
    }

    // ── Card frame reveal via IntersectionObserver ────────────────────
    // Cards gain class 'framed' when 30% visible, revealing the per-tab
    // decorative border defined in art-theme.css.
    var frameObserver = null;

    function observeCards() {
        if (!('IntersectionObserver' in window)) return;
        if (frameObserver) frameObserver.disconnect();
        frameObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) entry.target.classList.add('framed');
            });
        }, { threshold: 0.3 });
        document.querySelectorAll('.artwork-card').forEach(function (card) {
            frameObserver.observe(card);
        });
    }

    // Tapping a card also reveals its frame immediately
    document.addEventListener('click', function (e) {
        var card = e.target.closest && e.target.closest('.artwork-card');
        if (card) card.classList.add('framed');
    });

    // ── Magritte cloud injection ──────────────────────────────────────
    // Cloud divs appended to #app-container when on Search tab,
    // removed when leaving. CSS handles shape and animation via
    // .magritte-cloud class (defined in art-theme.css).
    var cloudTimer = null;

    function makeCloud() {
        var el = document.createElement('div');
        el.className = 'magritte-cloud';
        var size = 80 + Math.random() * 130;
        var top  = 8  + Math.random() * 52;
        var dur  = 26 + Math.random() * 22;
        el.style.cssText =
            'width:'   + size          + 'px;' +
            'height:'  + (size * 0.48) + 'px;' +
            'top:'     + top           + 'vh;' +
            'left:112vw;'                      +
            'opacity:' + (0.45 + Math.random() * 0.35) + ';' +
            'animation-duration:' + dur + 's;';
        el.addEventListener('animationend', function () { el.remove(); });
        return el;
    }

    function startClouds() {
        if (cloudTimer) return;
        var container = document.getElementById('app-container');
        if (!container) return;
        // Seed 3 clouds spread across the screen immediately
        for (var i = 0; i < 3; i++) {
            var seed = makeCloud();
            seed.style.left = (-10 + Math.random() * 110) + 'vw';
            container.appendChild(seed);
        }
        cloudTimer = setInterval(function () {
            var c = makeCloud();
            var cont = document.getElementById('app-container');
            if (cont) cont.appendChild(c);
        }, 9000 + Math.random() * 5000);
    }

    function stopClouds() {
        if (cloudTimer) { clearInterval(cloudTimer); cloudTimer = null; }
        document.querySelectorAll('.magritte-cloud').forEach(function (c) { c.remove(); });
    }

    // ── Tab change observer ───────────────────────────────────────────
    var lastTab = '';
    var tabObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
            if (m.attributeName !== 'data-tab') return;
            var tab = document.body.getAttribute('data-tab') || '';
            if (tab === lastTab) return;
            lastTab = tab;

            if (tab === 'feed')   revealTheme();
            if (tab === 'search') startClouds(); else stopClouds();

            // Re-observe cards after view renders
            setTimeout(observeCards, 300);
        });
    });

    document.addEventListener('DOMContentLoaded', function () {
        checkDaliFilters();
        tabObserver.observe(document.body, { attributes: true });
        var initial = document.body.getAttribute('data-tab') || 'feed';
        lastTab = initial;
        if (initial === 'feed')   revealTheme();
        if (initial === 'search') startClouds();
        setTimeout(observeCards, 500);
    });

}());
