/**
 * Onboarding Flow (Tinder swipe-style)
 * Fix: use localStorage flag to prevent infinite reload loop
 * Fix: no location.reload() — directly initialize router
 */
window.Onboarding = (function() {
    let deck = [];
    let currentIndex = 0;
    let swipeCount = 0;

    const overlay = document.getElementById('onboarding-overlay');
    const deckContainer = document.getElementById('swipe-deck');
    const controls = document.getElementById('onboarding-controls');

    async function init() {
        overlay.classList.remove('hidden');
        deckContainer.innerHTML = `
            <div style="text-align:center; padding: 3rem; opacity: 0.6;">
                <div style="font-size:3rem; margin-bottom:1rem; animation: pulse 1.5s ease infinite;">◎</div>
                <p>Loading the collection...</p>
            </div>`;

        try {
            deck = await window.API.get('/onboarding/deck');
            deckContainer.innerHTML = '';
            // Render from back to front so card 0 is on top
            for (let i = deck.length - 1; i >= 0; i--) {
                const card = createCard(deck[i], i);
                deckContainer.appendChild(card);
            }
        } catch(e) {
            console.error("Deck load failed:", e);
            deckContainer.innerHTML = '<p style="text-align:center; padding:2rem;">Failed to load. Please refresh.</p>';
        }

        document.getElementById('btn-skip-onboarding').onclick = completeOnboarding;
        document.getElementById('btn-continue-onboarding').onclick = () => {
            controls.classList.add('hidden');
        };
    }

    function createCard(artwork, index) {
        const el = document.createElement('div');
        el.className = 'swipe-card';
        el.id = `swipe-card-${index}`;

        // Images come from hardcoded seed data, always available
        const imgUrl = artwork.image_url_hd || artwork.image_url || '';

        el.innerHTML = `
            <div class="swipe-card-img-wrap">
                ${imgUrl
                    ? `<img src="${imgUrl}" alt="${artwork.title}" draggable="false" onerror="this.style.display='none'">`
                    : `<div class="swipe-card-placeholder">◎</div>`
                }
                <div class="swipe-card-gradient"></div>
            </div>
            <div class="swipe-info">
                <h3 class="swipe-title">${artwork.title}</h3>
                <p class="swipe-meta">${artwork.artist || 'Unknown'} &nbsp;·&nbsp; ${artwork.movement || ''} &nbsp;·&nbsp; ${artwork.year || ''}</p>
            </div>
            <div class="swipe-actions">
                <button class="btn-swipe btn-reject" title="Not for me" onclick="window.Onboarding.handleChoice(false)">
                    <svg viewBox="0 0 80 80" width="32" height="32"><line x1="15" y1="15" x2="65" y2="65" stroke="white" stroke-width="6" stroke-linecap="round"/><line x1="65" y1="15" x2="15" y2="65" stroke="white" stroke-width="6" stroke-linecap="round"/></svg>
                </button>
                <button class="btn-swipe btn-like" title="I love this" onclick="window.Onboarding.handleChoice(true)">
                    <svg viewBox="0 0 80 80" width="32" height="32"><path d="M40 65 C10 45 5 20 20 12 C30 7 38 15 40 22 C42 15 50 7 60 12 C75 20 70 45 40 65Z" fill="white"/></svg>
                </button>
            </div>
        `;
        return el;
    }

    async function handleChoice(liked) {
        if (currentIndex >= deck.length) return;

        const artwork = deck[currentIndex];
        const card = document.getElementById(`swipe-card-${currentIndex}`);
        if (!card) return;

        // Animate out
        const sign = liked ? 1 : -1;
        card.style.transition = 'transform 0.45s cubic-bezier(0.165, 0.84, 0.44, 1), opacity 0.45s ease';
        card.style.transform = `translateX(${sign * 130}%) rotate(${sign * 18}deg)`;
        card.style.opacity = '0';
        setTimeout(() => card.remove(), 450);

        // Save rating if liked (non-blocking — don't await so UI stays snappy)
        if (liked) {
            window.API.post('/onboarding/rate', {
                wikidata_id: artwork.wikidata_id,
                rating: 5,
            }).catch(e => console.warn('Rate save failed silently:', e));
        }

        currentIndex++;
        swipeCount++;

        // Show prompt after 10 swipes
        if (swipeCount === 10) {
            controls.classList.remove('hidden');
        }

        // Auto-complete when deck exhausted
        if (currentIndex >= deck.length) {
            await completeOnboarding();
        }
    }

    async function completeOnboarding() {
        overlay.classList.add('hidden');

        // Mark onboarding done in localStorage to prevent re-trigger on reload
        localStorage.setItem('artlog_onboarding_done', '1');

        try {
            await window.API.post('/onboarding/complete');
        } catch(e) {
            console.warn('Profile compute call failed, continuing anyway.');
        }

        // Don't reload — just activate the router directly
        if (typeof window.initRouter === 'function') {
            window.initRouter();
        } else {
            window.location.hash = '#discover';
        }
    }

    return { init, handleChoice };
})();
