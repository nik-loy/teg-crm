/**
 * Artwork Card Component
 */
window.Components = window.Components || {};

window.Components.ArtworkCard = (artwork, reasons = null, listType = null) => {
    // Prefer HD image if available, otherwise standard, otherwise placeholder
    const imgUrl = artwork.image_url_hd || artwork.image_url || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="100%" height="100%" fill="%23222"/></svg>';
    
    let reasonsHtml = '';
    if (reasons && reasons.length > 0) {
        reasonsHtml = `<div class="artwork-reasons">${reasons.join(' · ')}</div>`;
    }

    let metaHtml = [artwork.artist, artwork.year].filter(Boolean).join(', ');
    if (artwork.movement) metaHtml += ` · ${artwork.movement}`;

    return `
        <div class="artwork-card" onclick="window.viewArtworkDetails('${artwork.wikidata_id || ''}', ${artwork.id || 'null'})">
            <div class="artwork-img-container">
                <img class="artwork-img" src="${imgUrl}" alt="${artwork.title}" loading="lazy">
            </div>
            <div class="artwork-info">
                <div class="artwork-title">${artwork.title}</div>
                <div class="artwork-meta">${metaHtml}</div>
                ${reasonsHtml}
            </div>
        </div>
    `;
};

// Global function to open details modal
window.viewArtworkDetails = async (wikidataId, localId) => {
    try {
        let artwork;
        // If it's a completely remote artwork from search, trigger import
        if (!localId && wikidataId) {
            artwork = await window.API.post(`/artworks/import/${wikidataId}`);
        } else if (localId) {
            artwork = await window.API.get(`/artworks/${localId}`);
        }
        
        if (!artwork) return;
        renderModal(artwork);
    } catch (e) {
        console.error(e);
        alert('Failed to load details.');
    }
};

function renderModal(a) {
    const imgUrl = a.image_url_hd || a.image_url;
    let html = `
        <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 300px;">
                ${imgUrl ? `<img src="${imgUrl}" style="width: 100%; max-height: 70vh; object-fit: contain;">` : ''}
            </div>
            <div style="flex: 1; min-width: 300px;">
                <h1 style="margin-bottom: 0.5rem; font-family: var(--font-heading);">${a.title}</h1>
                <h3 style="color: var(--accent); margin-bottom: 1.5rem;">${a.artist || 'Unknown Artist'} ${a.year ? `(${a.year})` : ''}</h3>
                
                <p style="opacity: 0.8; margin-bottom: 2rem;">
                    <strong>Medium:</strong> ${a.medium || 'Unknown'}<br>
                    <strong>Movement:</strong> ${a.movement || 'Unknown'}<br>
                    <strong>Location:</strong> ${a.museum || 'Unknown'} ${a.museum_city ? `(${a.museum_city})` : ''}
                </p>
                
                ${a.description ? `<p style="margin-bottom: 2rem;">${a.description}</p>` : ''}
                
                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button class="btn" onclick="window.addToList(${a.id}, 'seen')">Mark Seen</button>
                    <button class="btn" onclick="window.addToList(${a.id}, 'bucket')">Add to Want-To-See</button>
                    ${a.wikidata_id ? `<a class="btn" href="https://www.wikidata.org/wiki/${a.wikidata_id}" target="_blank" style="text-decoration:none">Wikidata</a>` : ''}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('artwork-modal').classList.remove('hidden');
}

window.addToList = async (artworkId, type) => {
    try {
        await window.API.post('/list/add', { artwork_id: artworkId, list_type: type, rating: (type==='seen'? 5:null) });
        window.closeModal();
        window.updateNavStats();
        // Option to trigger a re-render of current view could go here
    } catch(e) {
        console.error(e);
        alert('Failed to add to list');
    }
};
