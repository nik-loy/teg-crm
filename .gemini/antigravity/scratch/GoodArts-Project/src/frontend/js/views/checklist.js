/**
 * Checklist View (Seen artworks)
 */
window.ChecklistView = {
    async render(container) {
        container.innerHTML = `<h2 class="mb-2">Your Gallery</h2><div id="checklist-grid" class="masonry-grid">Loading...</div>`;
        try {
            const items = await window.API.get('/checklist');
            const grid = document.getElementById('checklist-grid');
            if (items.length === 0) {
                grid.innerHTML = '<p>You haven\'t marked any artworks as seen yet.</p>';
                return;
            }
            grid.innerHTML = items.map(item => {
                // Pass a synthetic artwork object combining the base and the joined fields
                const art = { ...item };
                art.id = item.artwork_id; // For modal fetching
                return window.Components.ArtworkCard(art, [window.Components.RatingStars(item.rating)]);
            }).join('');
        } catch (e) {
            container.innerHTML = '<p>Error loading checklist.</p>';
        }
    }
};
