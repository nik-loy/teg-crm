window.ArtworkDetail = (function () {

    var ENRICHMENT_SECTIONS = [
        { key: 'formal_analysis',   label: 'Formal Analysis' },
        { key: 'technique_notes',   label: 'Technique & Medium' },
        { key: 'iconography',       label: 'Iconography & Symbolism' },
        { key: 'movement_context',  label: 'Art Movement Context' },
        { key: 'historical_period', label: 'Historical Period' },
        { key: 'impact_on_art',     label: 'Impact on Art' },
        { key: 'contemporary_rel',  label: 'Contemporary Relevance' },
        { key: 'provenance',        label: 'Provenance' },
        { key: 'artist_context',    label: 'About the Artist' },
        { key: 'fun_facts',         label: 'Fun Facts' },
    ];

    function clearEl(el) {
        while (el.firstChild) el.removeChild(el.firstChild);
    }

    function makeEl(tag, className, text) {
        var el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }

    async function open(localId, wikidataId) {
        var modal = document.getElementById('artwork-modal');
        var body  = document.getElementById('modal-body');
        if (!modal || !body) return;

        clearEl(body);
        var loading = makeEl('div', null, 'Loading\u2026');
        loading.style.cssText = 'text-align:center;padding:4rem;opacity:0.5;font-family:var(--font-ui)';
        body.appendChild(loading);
        modal.classList.remove('hidden');

        try {
            var artwork;
            if (localId) {
                artwork = await window.API.get('/artworks/' + localId);
            } else if (wikidataId) {
                artwork = await window.API.post('/artworks/import/' + wikidataId);
            }
            if (!artwork) throw new Error('no data');
            renderArtwork(body, artwork);
            loadEnrichment(artwork.id);
        } catch (_) {
            clearEl(body);
            body.appendChild(makeEl('p', null, 'Could not load artwork details.'));
        }
    }

    function renderArtwork(body, a) {
        clearEl(body);

        var layout = makeEl('div', 'detail-layout');

        var imgCol = makeEl('div', 'detail-image');
        var imgUrl = a.image_url_hd || a.image_url;
        if (imgUrl) {
            var img = document.createElement('img');
            img.src = imgUrl;
            img.alt = a.title || '';
            imgCol.appendChild(img);
        }

        var infoCol = makeEl('div', 'detail-info');

        infoCol.appendChild(makeEl('h2', 'detail-title', a.title || 'Untitled'));

        var artistLine = (a.artist || 'Unknown Artist') + (a.year ? ' (' + a.year + ')' : '');
        infoCol.appendChild(makeEl('p', 'detail-artist', artistLine));

        var meta = makeEl('div', 'detail-meta');
        [
            ['Medium',   a.medium],
            ['Movement', a.movement],
            ['Era',      a.era],
            ['Museum',   a.museum ? (a.museum + (a.museum_city ? ', ' + a.museum_city : '')) : null],
        ].forEach(function (pair) {
            if (!pair[1]) return;
            var p = makeEl('p');
            var b = makeEl('strong', null, pair[0] + ': ');
            p.appendChild(b);
            p.appendChild(document.createTextNode(pair[1]));
            meta.appendChild(p);
        });
        infoCol.appendChild(meta);

        var actions = makeEl('div', 'detail-actions');

        var btnSeen = makeEl('button', 'btn', 'Mark Seen');
        btnSeen.addEventListener('click', function () { window.addToList(a.id, 'seen'); });

        var btnWish = makeEl('button', 'btn', 'Add to Wishlist');
        btnWish.addEventListener('click', function () { window.addToList(a.id, 'bucket'); });

        actions.appendChild(btnSeen);
        actions.appendChild(btnWish);

        if (a.wikidata_id) {
            var wdLink = document.createElement('a');
            wdLink.className = 'btn';
            wdLink.href = 'https://www.wikidata.org/wiki/' + encodeURIComponent(a.wikidata_id);
            wdLink.target = '_blank';
            wdLink.rel = 'noopener noreferrer';
            wdLink.textContent = 'Wikidata';
            wdLink.style.textDecoration = 'none';
            actions.appendChild(wdLink);
        }

        infoCol.appendChild(actions);

        var enrichWrap = makeEl('div', null);
        enrichWrap.id = 'enrichment-sections';
        enrichWrap.style.marginTop = '2rem';

        var enrichLabel = makeEl('p', null, 'Learn More');
        enrichLabel.style.cssText = 'font-family:var(--font-ui);font-size:0.75rem;text-transform:uppercase;letter-spacing:0.12em;opacity:0.4;margin-bottom:0.5rem;';
        enrichWrap.appendChild(enrichLabel);

        var enrichLoading = makeEl('div', null, 'Loading art-historical context\u2026');
        enrichLoading.id = 'enrich-loading';
        enrichLoading.style.cssText = 'font-family:var(--font-ui);font-size:0.8rem;opacity:0.4;';
        enrichWrap.appendChild(enrichLoading);

        infoCol.appendChild(enrichWrap);

        layout.appendChild(imgCol);
        layout.appendChild(infoCol);
        body.appendChild(layout);
    }

    async function loadEnrichment(artworkId) {
        var container = document.getElementById('enrichment-sections');
        if (!container) return;

        try {
            var data = await window.API.getEnrichment(artworkId);

            var loadingEl = document.getElementById('enrich-loading');
            if (loadingEl) loadingEl.parentNode.removeChild(loadingEl);

            var hasAny = false;
            ENRICHMENT_SECTIONS.forEach(function (section) {
                var content = data[section.key];
                if (!content) return;

                if (section.key === 'fun_facts') {
                    try { content = JSON.parse(content); } catch (_) { content = [String(content)]; }
                    if (!Array.isArray(content) || !content.length) return;
                    content = content.join(' \u00b7 ');
                }

                if (typeof content !== 'string' || !content.trim()) return;
                hasAny = true;

                var wrap = makeEl('div', 'expandable');
                var header = makeEl('div', 'expandable-header');
                header.appendChild(makeEl('span', null, section.label));
                header.appendChild(makeEl('span', 'expandable-chevron', '\u25be'));
                header.addEventListener('click', function () { wrap.classList.toggle('open'); });

                var bodyEl = makeEl('div', 'expandable-body');
                bodyEl.appendChild(makeEl('p', null, content));

                wrap.appendChild(header);
                wrap.appendChild(bodyEl);
                container.appendChild(wrap);
            });

            if (!hasAny) {
                container.appendChild(makeEl('p', null, 'No additional context available for this artwork.'));
            }
        } catch (_) {
            var el = document.getElementById('enrich-loading');
            if (el) el.textContent = 'Art-historical context unavailable.';
        }
    }

    return { open: open };
}());

window.viewArtworkDetails = function (wikidataId, localId) {
    window.ArtworkDetail.open(localId || null, wikidataId || null);
};
