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
            loadDossier(artwork.id);
        } catch (_) {
            clearEl(body);
            body.appendChild(makeEl('p', null, 'Could not load artwork details.'));
        }
    }

    function renderArtwork(body, a) {
        clearEl(body);

        var layout = makeEl('div', 'detail-layout');
        var imgCol = makeEl('div', 'detail-image');
        if (a.image_url_hd || a.image_url) {
            var img = document.createElement('img');
            img.src = window.API.proxyImage(a.image_url_hd || a.image_url);
            img.alt = a.title;
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
        infoCol.appendChild(actions);

        // -- TABS -------------------------------------------------------------
        var tabBar = makeEl('div', 'detail-tabs');
        var tabOverview = makeEl('button', 'detail-tab active', 'Overview');
        var tabDossier  = makeEl('button', 'detail-tab', 'Technical Dossier');
        tabBar.appendChild(tabOverview);
        tabBar.appendChild(tabDossier);
        infoCol.appendChild(tabBar);

        // Panels
        var panelOverview = makeEl('div', 'detail-panel');
        var panelDossier  = makeEl('div', 'detail-panel hidden');
        infoCol.appendChild(panelOverview);
        infoCol.appendChild(panelDossier);

        tabOverview.onclick = function() {
            tabOverview.classList.add('active'); tabDossier.classList.remove('active');
            panelOverview.classList.remove('hidden'); panelDossier.classList.add('hidden');
        };
        tabDossier.onclick = function() {
            tabDossier.classList.add('active'); tabOverview.classList.remove('active');
            panelDossier.classList.remove('hidden'); panelOverview.classList.add('hidden');
        };

        // Overview content (Enrichment + Logs)
        var enrichWrap = makeEl('div', null);
        enrichWrap.id = 'enrichment-sections';
        var enrichLoading = makeEl('div', 'enrich-loading', 'Loading context\u2026');
        enrichLoading.id = 'enrich-loading';
        enrichWrap.appendChild(enrichLoading);
        panelOverview.appendChild(enrichWrap);

        var logsWrap = makeEl('div', 'logs-section');
        logsWrap.style.marginTop = '2rem';
        logsWrap.style.borderTop = '1px solid rgba(255,255,255,0.05)';
        logsWrap.style.paddingTop = '1.5rem';
        logsWrap.appendChild(makeEl('p', 'dossier-field-label', 'My Research & Notes'));
        var logsList = makeEl('div', 'logs-list');
        logsList.id = 'artwork-logs-list';
        logsWrap.appendChild(logsList);
        var logForm = makeEl('div', 'log-form');
        var logInput = makeEl('textarea', 'search-input', '');
        logInput.placeholder = 'Add a discovery or note...';
        logInput.rows = 2;
        logForm.appendChild(logInput);
        var logBtn = makeEl('button', 'btn btn-outline', 'Add Note');
        logBtn.onclick = async function() {
            var content = logInput.value.trim();
            if (!content) return;
            await window.API.createLog({ artwork_id: a.id, content: content });
            logInput.value = '';
            loadLogs(a.id);
        };
        logForm.appendChild(logBtn);
        logsWrap.appendChild(logForm);
        panelOverview.appendChild(logsWrap);

        // Dossier content
        var dossierWrap = makeEl('div', null);
        dossierWrap.id = 'dossier-sections';
        var dossierLoading = makeEl('div', null, 'Loading technical analysis\u2026');
        dossierLoading.id = 'dossier-loading';
        dossierWrap.appendChild(dossierLoading);
        panelDossier.appendChild(dossierWrap);

        layout.appendChild(imgCol);
        layout.appendChild(infoCol);
        body.appendChild(layout);
        
        loadLogs(a.id);
    }

    async function loadLogs(artworkId) {
        var list = document.getElementById('artwork-logs-list');
        if (!list) return;
        try {
            var logs = await window.API.getLogs({ artwork_id: artworkId });
            clearEl(list);
            logs.forEach(function(log) {
                var item = makeEl('div', 'log-item');
                item.style.cssText = 'padding:0.75rem;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:0.5rem;font-size:0.9rem;position:relative;';
                var date = makeEl('div', null, new Date(log.created_at).toLocaleDateString());
                date.style.cssText = 'font-size:0.7rem;opacity:0.4;margin-bottom:0.25rem;';
                item.appendChild(date);
                item.appendChild(makeEl('div', null, log.content));
                var del = makeEl('span', null, '\u00d7');
                del.style.cssText = 'position:absolute;top:0.5rem;right:0.5rem;cursor:pointer;opacity:0.3;';
                del.onclick = async function() {
                    if(confirm('Delete?')) { await window.API.deleteLog(log.id); loadLogs(artworkId); }
                };
                item.appendChild(del);
                list.appendChild(item);
            });
        } catch(e) {}
    }

    async function loadEnrichment(artworkId) {
        var container = document.getElementById('enrichment-sections');
        if (!container) return;
        try {
            var data = await window.API.getEnrichment(artworkId);
            var loadingEl = document.getElementById('enrich-loading');
            if (loadingEl) loadingEl.remove();
            ENRICHMENT_SECTIONS.forEach(function (s) {
                var content = data[s.key];
                if (!content) return;
                var wrap = makeEl('div', 'expandable');
                var header = makeEl('div', 'expandable-header');
                header.innerHTML = `<span>${s.label}</span><span class="expandable-chevron">\u25be</span>`;
                header.onclick = () => wrap.classList.toggle('open');
                var body = makeEl('div', 'expandable-body');
                body.appendChild(makeEl('p', null, content));
                wrap.appendChild(header); wrap.appendChild(body);
                container.appendChild(wrap);
            });
        } catch (_) {
            var el = document.getElementById('enrich-loading');
            if (el) el.textContent = 'Enrichment unavailable.';
        }
    }

    async function loadDossier(artworkId) {
        var container = document.getElementById('dossier-sections');
        if (!container) return;

        async function _poll() {
            try {
                var data = await window.API.getDossier(artworkId);
                if (data.status === 'enriching') {
                    setTimeout(_poll, 3000);
                    return;
                }
                renderDossier(container, data);
            } catch(e) {
                container.textContent = 'Technical dossier unavailable.';
            }
        }
        _poll();
    }

    function renderDossier(container, d) {
        clearEl(container);
        if (d.status !== 'complete') {
            container.appendChild(makeEl('p', null, 'Dossier data not found for this work.'));
            return;
        }

        var grid = makeEl('div', 'dossier-grid');
        
        function addField(label, value, parent = grid) {
            if (!value) return;
            var f = makeEl('div', 'dossier-field');
            f.appendChild(makeEl('div', 'dossier-field-label', label));
            f.appendChild(makeEl('div', 'dossier-field-value', value));
            parent.appendChild(f);
        }

        // Materials & Techniques
        if (d.materials) {
            addField('Medium', d.materials.medium_display);
            if (d.materials.technique_definitions) {
                var defs = d.materials.technique_definitions;
                var list = makeEl('div', 'dossier-field-value');
                Object.keys(defs).forEach(t => {
                    var item = makeEl('div', null);
                    item.style.marginBottom = '0.5rem';
                    item.innerHTML = `<strong>${t}</strong>: ${defs[t].definition}`;
                    list.appendChild(item);
                });
                addField('Techniques (Thesaurus)', list);
            }
        }

        // Physical
        if (d.physical) {
            addField('Dimensions', d.physical.dimensions);
            addField('Inscriptions', d.physical.inscriptions);
        }

        // Artist (ULAN)
        if (d.artist) {
            addField('Artist Bio (ULAN)', d.artist.bio);
            addField('Nationality', d.artist.nationality);
            if (d.artist.birth_year) addField('Life', `${d.artist.birth_year} \u2014 ${d.artist.death_year || 'Present'}`);
        }

        // Lineage
        if (d.lineage) {
            if (d.lineage.influenced_by && d.lineage.influenced_by.length) {
                addField('Influenced By', d.lineage.influenced_by.join(', '));
            }
            if (d.lineage.influenced && d.lineage.influenced.length) {
                addField('Influenced', d.lineage.influenced.join(', '));
            }
        }

        container.appendChild(grid);
        
        if (d.data_sources) {
            var sources = makeEl('div', null);
            sources.style.marginTop = '2rem';
            sources.style.opacity = '0.3';
            sources.style.fontSize = '0.65rem';
            sources.textContent = 'Verified Sources: ' + d.data_sources.join(', ');
            container.appendChild(sources);
        }
    }

    return { open: open };
}());

window.viewArtworkDetails = function (wikidataId, localId) {
    window.ArtworkDetail.open(localId || null, wikidataId || null);
};
