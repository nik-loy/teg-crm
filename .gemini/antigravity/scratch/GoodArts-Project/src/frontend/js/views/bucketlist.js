/**
 * Bucket List View
 */
window.BucketlistView = {
    async render(container) {
        container.innerHTML = `<h2 class="mb-2">Bucket List</h2><div id="bucketlist-grid" class="masonry-grid">Loading...</div>`;
        try {
            const items = await window.API.get('/bucketlist');
            const grid = document.getElementById('bucketlist-grid');
            if (items.length === 0) {
                grid.innerHTML = '<p>Your bucket list is empty.</p>';
                return;
            }
            grid.innerHTML = items.map(item => {
                const art = { ...item };
                art.id = item.artwork_id;
                return window.Components.ArtworkCard(art);
            }).join('');
        } catch (e) {
            container.innerHTML = '<p>Error loading bucket list.</p>';
        }
    }
};
