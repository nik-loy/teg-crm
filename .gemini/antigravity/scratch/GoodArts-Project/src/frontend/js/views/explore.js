/**
 * Explore View & Custom Add Logic
 */
window.ExploreView = {
    async render(container) {
        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;" class="mb-2">
                <h2>Explore Masterpieces</h2>
                <button class="btn btn-messy" onclick="window.ExploreView.openCustomModal()" style="font-size:0.9rem; padding: 1rem 2rem;">+ Add Custom Artwork</button>
            </div>
            <div id="explore-content">
                <div style="text-align:center; opacity:0.6; padding: 4rem;">
                    <div style="font-size:3rem; margin-bottom:1rem; animation: pulse 1.5s ease infinite;">◎</div>
                    Fetching collections...
                </div>
            </div>
        `;
        
        try {
            const data = await window.API.get('/explore');
            let html = '';
            
            data.categories.forEach(cat => {
                if (cat.artworks.length > 0) {
                    html += `
                        <h2 class="italic-heading" style="font-size:2rem; margin-bottom:2rem; margin-top:2rem;">${cat.name}</h2>
                        <div class="masonry-grid mb-2">
                            ${cat.artworks.map(a => window.Components.ArtworkCard(a)).join('')}
                        </div>
                    `;
                }
            });
            
            document.getElementById('explore-content').innerHTML = html || '<p>No collections found right now.</p>';
        } catch (e) {
            document.getElementById('explore-content').innerHTML = '<p>Error loading explore data. Please try again.</p>';
        }
    },

    openCustomModal() {
        document.getElementById('custom-artwork-modal').classList.remove('hidden');
    },

    closeCustomModal() {
        document.getElementById('custom-artwork-modal').classList.add('hidden');
    },

    async submitCustomArtwork() {
        const title = document.getElementById('custom-title').value.trim();
        const artist = document.getElementById('custom-artist').value.trim();
        const year = parseInt(document.getElementById('custom-year').value.trim());
        const img = document.getElementById('custom-img').value.trim();
        
        if (!title) {
            alert("Title is required."); return;
        }

        const payload = {
            title: title,
            source: 'manual',
            artist: artist || null,
            year: isNaN(year) ? null : year,
            image_url: img || null,
            image_url_hd: img || null
        };

        try {
            const result = await window.API.post('/artworks', payload);
            this.closeCustomModal();
            // Automatically open details modal for the newly created artwork
            if (window.viewArtworkDetails) {
                window.viewArtworkDetails(null, result.id);
            }
            // Clear inputs
            document.getElementById('custom-title').value = '';
            document.getElementById('custom-artist').value = '';
            document.getElementById('custom-year').value = '';
            document.getElementById('custom-img').value = '';
        } catch(e) {
            console.error(e);
            alert("Failed to create artwork.");
        }
    }
};
