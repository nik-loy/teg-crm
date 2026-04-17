/**
 * Dashboard View (Optional fallback/stats overview)
 */
window.DashboardView = {
    async render(container) {
        container.innerHTML = `<h2 class="mb-2">Profile Overview</h2><div id="dash-grid">Loading...</div>`;
        try {
            const stats = await window.API.get('/stats');
            container.innerHTML = `
                <h1 style="font-size: 3rem; margin-bottom: 2rem;">Overview</h1>
                <div style="display:flex; gap: 2rem; flex-wrap: wrap;">
                    <div style="padding: 2rem; border: var(--border-messy); flex:1">
                        <h3>Seen</h3>
                        <div style="font-size: 4rem; color: var(--accent); font-family: var(--font-heading)">${stats.seen_count}</div>
                    </div>
                    <div style="padding: 2rem; border: var(--border-messy); flex:1">
                        <h3>Bucket List</h3>
                        <div style="font-size: 4rem; color: var(--accent); font-family: var(--font-heading)">${stats.bucket_count}</div>
                    </div>
                    <div style="padding: 2rem; border: var(--border-messy); flex:1">
                        <h3>Avg Rating</h3>
                        <div style="font-size: 4rem; color: var(--accent); font-family: var(--font-heading)">${stats.avg_rating}</div>
                    </div>
                </div>
                <div class="mt-2 text-center">
                    <button class="btn" onclick="window.API.post('/taste-profile/recompute').then(()=>alert('Recomputed!'))">Recalibrate Taste Profile</button>
                </div>
            `;
        } catch(e) {
            container.innerHTML = '<p>Error loading dashboard.</p>';
        }
    }
};
