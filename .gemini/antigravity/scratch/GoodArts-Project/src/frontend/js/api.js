const API = {
    async get(endpoint) {
        const res = await fetch('/api' + endpoint);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async post(endpoint, data) {
        const res = await fetch('/api' + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data || {})
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async patch(endpoint, data) {
        const res = await fetch('/api' + endpoint, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data || {})
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async upload(endpoint, formData) {
        const res = await fetch('/api' + endpoint, { method: 'POST', body: formData });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async delete(endpoint) {
        const res = await fetch('/api' + endpoint, { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
        return res.status === 204 ? null : res.json();
    },

    getExhibitions(city) {
        const q = city ? ('?city=' + encodeURIComponent(city)) : '';
        return this.get('/exhibitions' + q);
    },

    getExhibition(id)            { return this.get('/exhibitions/' + id); },
    setExhibitionStatus(id, s)   { return this.patch('/exhibitions/' + id + '/status', { status: s }); },
    getVisits()                  { return this.get('/visits'); },
    createVisit(data)            { return this.post('/visits', data); },
    getEnrichment(artworkId)     { return this.get('/artworks/' + artworkId + '/enriched'); },
    getAnnotations(artworkId)    { return this.get('/artworks/' + artworkId + '/annotations'); },
    createAnnotation(id, data)   { return this.post('/artworks/' + id + '/annotations', data); },
    getSettings()                { return this.get('/settings'); },
    updateSettings(data)         { return this.patch('/settings', data); },
};

window.API = API;
