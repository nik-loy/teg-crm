/**
 * GoodArts - Search View (Multi-Provider)
 */
window.SearchView = {
    render(container) {
        container.textContent = '';

        var inp = document.createElement('input');
        inp.type = 'text'; inp.id = 'search-input'; inp.className = 'search-input';
        inp.placeholder = 'Search artists, titles, movements…'; inp.autocomplete = 'off';

        var status = document.createElement('div');
        status.id = 'search-status';
        status.style.cssText = 'opacity:0.6;font-family:var(--font-ui);font-size:0.85rem;margin-top:0.75rem;min-height:1.2rem;';

        var results = document.createElement('div');
        results.id = 'search-results'; results.className = 'search-results-grid mb-2';

        var collHeading = document.createElement('h2');
        collHeading.id = 'explore-heading';
        collHeading.className = 'section-heading'; collHeading.style.marginTop = '2rem';
        collHeading.textContent = 'Browse Collections';

        var collEl = document.createElement('div');
        collEl.id = 'explore-collections';

        container.appendChild(inp); container.appendChild(status);
        container.appendChild(results); container.appendChild(collHeading);
        container.appendChild(collEl);

        var timeout = null;
        var self = this;
        inp.addEventListener('input', function(e) {
            clearTimeout(timeout);
            var q = e.target.value.trim();
            var cEl = document.getElementById('explore-collections');
            var cHeading = document.getElementById('explore-heading');
            
            if (q.length < 2) {
                results.textContent = ''; status.textContent = ''; 
                if (cEl) cEl.style.display = 'block';
                if (cHeading) cHeading.style.display = 'block';
                return;
            }
            if (cEl) cEl.style.display = 'none';
            if (cHeading) cHeading.style.display = 'none';

            status.textContent = 'Searching archives…';
            timeout = setTimeout(function() { self.performSearch(q); }, 600);
        });

        setTimeout(function() { inp.focus(); }, 100);
        this.loadCollections();
    },

    async performSearch(q) {
        var resultsEl = document.getElementById('search-results');
        var statusEl = document.getElementById('search-status');
        try {
            var data = await window.API.get('/search?q=' + encodeURIComponent(q));
            var all = (data.local || []).concat(data.remote || []);
            if (statusEl) {
                statusEl.textContent = 'Found ' + all.length + ' result' + (all.length !== 1 ? 's' : '') + '.';
                if (data.suggestion) {
                    var suggSpan = document.createElement('span');
                    suggSpan.textContent = ' Did you mean ';
                    var suggLink = document.createElement('a');
                    suggLink.textContent = data.suggestion;
                    suggLink.style.cssText = 'color:var(--color-accent);cursor:pointer;text-decoration:underline;font-weight:bold;';
                    suggLink.onclick = function() {
                        var inp = document.getElementById('search-input');
                        if (inp) {
                            inp.value = data.suggestion;
                            inp.dispatchEvent(new Event('input'));
                        }
                    };
                    suggSpan.appendChild(suggLink);
                    suggSpan.appendChild(document.createTextNode('?'));
                    statusEl.appendChild(suggSpan);
                }
            }
            if (resultsEl) {
                resultsEl.textContent = '';
                if (all.length === 0) {
                    var p = document.createElement('p'); p.style.opacity = '0.5';
                    p.textContent = 'No results found.'; resultsEl.appendChild(p);
                } else {
                    all.forEach(function(a) { resultsEl.appendChild(window.Components.ArtworkCard(a)); });
                }
            }
        } catch (e) {
            if (statusEl) statusEl.textContent = 'Search failed.';
        }
    },

    async loadCollections() {
        var el = document.getElementById('explore-collections');
        if (!el) return;
        try {
            var data = await window.API.get('/explore');
            el.textContent = '';
            var hasContent = false;
            (data.categories || []).forEach(function(cat) {
                if (!cat.artworks || !cat.artworks.length) return;
                hasContent = true;
                var h = document.createElement('h3');
                h.className = 'section-subheading'; h.textContent = cat.name;
                var grid = document.createElement('div');
                grid.className = 'search-results-grid mb-2';
                cat.artworks.forEach(function(a) { grid.appendChild(window.Components.ArtworkCard(a)); });
                el.appendChild(h); el.appendChild(grid);
            });
            if (!hasContent) {
                var p = document.createElement('p'); p.style.opacity = '0.5';
                p.textContent = 'No collections available yet.'; el.appendChild(p);
            }
        } catch (e) { el.textContent = ''; }
    }
};
