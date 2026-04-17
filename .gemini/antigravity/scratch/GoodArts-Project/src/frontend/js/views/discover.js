/**
 * Discover View (4-tier Recommendations)
 */
window.DiscoverView = {
    async render(container) {
        container.innerHTML = `<h2 class="mb-2">Curating exhibitions...</h2>`;
        
        try {
            const data = await window.API.get('/recommend');
            
            let html = ``;

            // 1. Personalized
            if (data.personalized_artworks.length > 0) {
                html += `
                    <h2 class="mb-2">Selected For You</h2>
                    <div class="masonry-grid mb-2">
                        ${data.personalized_artworks.map(r => window.Components.ArtworkCard(r.artwork, r.reasons)).join('')}
                    </div>
                `;
            }

            // 2. Must-See
            if (data.must_see_artworks.length > 0) {
                html += `
                    <h2 class="mb-2 mt-2">Global Masterpieces</h2>
                    <div class="masonry-grid mb-2">
                        ${data.must_see_artworks.map(a => window.Components.ArtworkCard(a)).join('')}
                    </div>
                `;
            }

            // 3. Personalized Museums
            if (data.personalized_museums.length > 0) {
                html += `
                    <h2 class="mb-2 mt-2">Exhibits Matching Your Taste</h2>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 2rem" class="mb-2">
                        ${data.personalized_museums.map(m => `
                            <div class="museum-card">
                                <div class="museum-name">${m.museum_name}</div>
                                <div style="opacity: 0.7">${m.city}, ${m.country}</div>
                                <div class="museum-why">${m.why}</div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            // 4. Popular Museums
            if (data.popular_museums.length > 0) {
                html += `
                    <h2 class="mb-2 mt-2">World's Greatest Museums</h2>
                    <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem" class="mb-2">
                        ${data.popular_museums.map(m => `
                            <div style="padding: 1rem; border: 1px solid rgba(255,255,255,0.1)">
                                <strong>${m.name}</strong><br>
                                <span style="font-size:0.8rem; opacity:0.6">${m.city}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            container.innerHTML = html;

        } catch (e) {
            container.innerHTML = `<p style="color:red">Error loading discover queue.</p>`;
        }
    }
};
