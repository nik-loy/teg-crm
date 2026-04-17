/**
 * Search View
 */
window.SearchView = {
    render(container) {
        container.innerHTML = `
            <input type="text" id="search-input" class="search-input" placeholder="Search artists, titles, or movements..." autocomplete="off">
            <div id="search-status" class="mb-2" style="opacity:0.6"></div>
            <h2 class="mb-2">Local Library</h2>
            <div id="search-results-local" class="masonry-grid mb-2"></div>
            <h2 class="mb-2 mt-2">Global Archives (Wikidata & Europeana)</h2>
            <div id="search-results-remote" class="masonry-grid mb-2"></div>
        `;

        const input = document.getElementById('search-input');
        let timeout = null;

        input.addEventListener('input', (e) => {
            clearTimeout(timeout);
            const q = e.target.value.trim();
            if (q.length < 2) {
                document.getElementById('search-results-local').innerHTML = '';
                document.getElementById('search-results-remote').innerHTML = '';
                document.getElementById('search-status').innerText = '';
                return;
            }
            
            document.getElementById('search-status').innerText = 'Searching archives...';
            timeout = setTimeout(() => this.performSearch(q), 800);
        });
        
        // Focus input
        setTimeout(() => input.focus(), 100);
    },

    async performSearch(q) {
        try {
            const data = await window.API.get(`/search?q=${encodeURIComponent(q)}`);
            document.getElementById('search-status').innerText = `Found ${data.local.length} local and ${data.remote.length} remote masterpieces.`;
            
            document.getElementById('search-results-local').innerHTML = 
                data.local.map(a => window.Components.ArtworkCard(a)).join('') || '<p>No local matches.</p>';
                
            document.getElementById('search-results-remote').innerHTML = 
                data.remote.map(a => window.Components.ArtworkCard(a)).join('') || '<p>No remote matches.</p>';

        } catch (e) {
            document.getElementById('search-status').innerText = 'Search failed.';
        }
    }
};
