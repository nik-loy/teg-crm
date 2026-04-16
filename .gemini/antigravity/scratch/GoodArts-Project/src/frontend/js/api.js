/**
 * ArtLog API Fetch Wrapper
 */
const API = {
    async get(endpoint) {
        const res = await fetch(`/api${endpoint}`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async post(endpoint, data = {}) {
        const res = await fetch(`/api${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async patch(endpoint, data = {}) {
        const res = await fetch(`/api${endpoint}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async upload(endpoint, formData) {
        const res = await fetch(`/api${endpoint}`, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async delete(endpoint) {
        const res = await fetch(`/api${endpoint}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    // Feed
    getFeed() {
        return this.get('/feed');
    },

    getDailyMasterpiece() {
        return this.get('/feed/daily');
    },

    swipe(artworkId, direction) {
        return this.post('/feed/swipe', { artwork_id: artworkId, direction });
    },

    // Exhibitions
    getExhibitions(city) {
        const query = city ? `?city=${encodeURIComponent(city)}` : '';
        return this.get(`/exhibitions${query}`);
    },

    getExhibition(id) {
        return this.get(`/exhibitions/${id}`);
    },

    setExhibitionStatus(id, status) {
        return this.patch(`/exhibitions/${id}/status`, { status });
    },

    // Visits
    getVisits() {
        return this.get('/visits');
    },

    createVisit(data) {
        return this.post('/visits', data);
    },

    // Artworks
    getEnrichment(artworkId) {
        return this.get(`/artworks/${artworkId}/enrichment`);
    },

    getAnnotations(artworkId) {
        return this.get(`/artworks/${artworkId}/annotations`);
    },

    createAnnotation(artworkId, data) {
        return this.post(`/artworks/${artworkId}/annotations`, data);
    },

    // Settings
    getSettings() {
        return this.get('/settings');
    },

    updateSettings(data) {
        return this.patch('/settings', data);
    }
};

window.API = API;
