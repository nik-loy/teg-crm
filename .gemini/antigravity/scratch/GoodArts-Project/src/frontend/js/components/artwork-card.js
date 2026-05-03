window.Components = window.Components || {};

window.Components.ArtworkCard = function (artwork, reasons) {
    var card = document.createElement('div');
    card.className = 'artwork-card';
    card.addEventListener('click', function () {
        window.ArtworkDetail.open(artwork.id || null, artwork.wikidata_id || null);
    });

    var imgUrl = artwork.image_url_hd || artwork.image_url || '';
    var imgWrap = document.createElement('div');
    imgWrap.className = 'artwork-img-container';
    if (imgUrl) {
        var img = document.createElement('img');
        img.className = 'artwork-img';
        img.src = window.API.proxyImage(imgUrl);
        img.alt = artwork.title || '';
        img.loading = 'lazy';
        imgWrap.appendChild(img);
    }

    var info = document.createElement('div');
    info.className = 'artwork-info';

    var titleEl = document.createElement('div');
    titleEl.className = 'artwork-title';
    titleEl.textContent = artwork.title || 'Untitled';

    var metaParts = [artwork.artist, artwork.year].filter(Boolean).join(', ');
    if (artwork.movement) metaParts += ' \u00b7 ' + artwork.movement;
    var metaEl = document.createElement('div');
    metaEl.className = 'artwork-meta';
    metaEl.textContent = metaParts;

    info.appendChild(titleEl);
    info.appendChild(metaEl);

    if (reasons && reasons.length > 0) {
        var reasonsEl = document.createElement('div');
        reasonsEl.className = 'artwork-reasons';
        reasonsEl.textContent = reasons.join(' \u00b7 ');
        info.appendChild(reasonsEl);
    }

    card.appendChild(imgWrap);
    card.appendChild(info);
    return card;
};
