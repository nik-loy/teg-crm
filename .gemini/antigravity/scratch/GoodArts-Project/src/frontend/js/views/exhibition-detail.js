window.ExhibitionDetailView = {
    async open(exhibitionId) {
        console.log("Opening exhibition detail:", exhibitionId);
        var modal = document.getElementById("artwork-modal");
        var body = document.getElementById("modal-body");
        if (!modal || !body) {
            console.error("Modal elements missing");
            return;
        }

        // Full Reset of Modal State
        modal.className = "overlay"; // Remove hidden, but also any other accidental classes
        body.innerHTML = "";
        body.scrollTop = 0;
        
        // Show Loading
        body.innerHTML = '<div style="text-align:center; padding: 4rem;"><p style="opacity:0.5; margin-bottom:1rem;">Curating exhibition details...</p><div class="spinner"></div></div>';
        
        // Explicitly set pointer-events to ensure it's clickable
        modal.style.pointerEvents = "auto";
        modal.style.opacity = "1";
        
        // Ensure scroll to top
        body.scrollTop = 0;

        try {
            var exh = await window.API.get(`/exhibitions/${exhibitionId}`);
            console.log("Fetched exhibition:", exh);
            if (!exh) throw new Error("No data returned");
            this.render(body, exh);
        } catch(e) {
            console.error("Exhibition load failed:", e);
            body.innerHTML = `<p style="color:var(--accent); text-align:center; padding: 4rem;">Failed to load exhibition details.<br><small style="opacity:0.5">${e.message}</small></p>`;
        }
    },

    render(container, exh) {
        container.textContent = "";
        
        var layout = document.createElement("div");
        layout.className = "exh-detail-container";

        // Hero Section
        var hero = document.createElement("div");
        hero.className = "exh-detail-hero";
        var img = document.createElement("img");
        img.src = exh.image_url || "https://images.unsplash.com/photo-1544413647-ad3481aa520b?auto=format&fit=crop&q=80&w=1200";
        img.onerror = () => { img.src = "https://images.unsplash.com/photo-1544413647-ad3481aa520b?auto=format&fit=crop&q=80&w=1200"; };
        hero.appendChild(img);

        var heroOverlay = document.createElement("div");
        heroOverlay.className = "exh-detail-hero-overlay";
        
        if (exh.taste_affinity > 0) {
            var badgeContainer = document.createElement("div");
            badgeContainer.style.marginBottom = "1rem";
            var affBadge = document.createElement("span");
            affBadge.className = "exh-affinity";
            affBadge.textContent = Math.round(exh.taste_affinity * 100) + "% MATCH";
            badgeContainer.appendChild(affBadge);
            heroOverlay.appendChild(badgeContainer);
        }
        
        var title = document.createElement("h1");
        title.className = "exh-detail-title";
        title.textContent = exh.title;
        
        var venueContainer = document.createElement("div");
        venueContainer.style.display = "flex";
        venueContainer.style.flexDirection = "column";
        venueContainer.style.gap = "0.25rem";
        venueContainer.style.marginTop = "0.5rem";
        
        var venue = document.createElement("div");
        venue.className = "exh-detail-venue";
        venue.innerHTML = `<strong>${exh.venue_name || "Exhibition"}</strong>`;
        
        var locAndDates = document.createElement("div");
        locAndDates.style.fontFamily = "var(--font-ui)";
        locAndDates.style.opacity = "0.8";
        
        const locString = [exh.city, exh.country].filter(Boolean).join(", ");
        const dateString = (exh.start_date || "?") + " — " + (exh.end_date || "?");
        locAndDates.textContent = (locString ? locString + " • " : "") + dateString;
        
        venueContainer.appendChild(venue);
        venueContainer.appendChild(locAndDates);
        
        if (exh.url) {
            var linkBtn = document.createElement("button");
            linkBtn.className = "btn btn-sm btn-outline";
            linkBtn.style.marginTop = "1rem";
            linkBtn.style.alignSelf = "flex-start";
            linkBtn.innerHTML = 'Visit Website ↗';
            linkBtn.onclick = () => window.open(exh.url, '_blank');
            venueContainer.appendChild(linkBtn);
        }
        
        heroOverlay.appendChild(title);
        heroOverlay.appendChild(venueContainer);
        hero.appendChild(heroOverlay);
        layout.appendChild(hero);

        // Content Grid
        var content = document.createElement("div");
        content.className = "exh-detail-content";

        // Main Column
        var mainCol = document.createElement("div");
        
        // Description
        var descSec = document.createElement("div");
        descSec.className = "exh-detail-section";
        var descTitle = document.createElement("div");
        descTitle.className = "exh-detail-section-title";
        descTitle.textContent = "About the Exhibition";
        descSec.appendChild(descTitle);
        
        var desc = document.createElement("div");
        desc.className = "exh-description";
        desc.textContent = exh.description || "No description available for this event.";
        descSec.appendChild(desc);
        mainCol.appendChild(descSec);

        // All Artworks (Research Tool)
        var allSec = document.createElement("div");
        allSec.className = "exh-detail-section";
        var allTitle = document.createElement("div");
        var artCount = (exh.all_artworks || []).length;
        allTitle.className = "exh-detail-section-title";
        allTitle.innerHTML = `<span>Works on Display</span><span style="opacity:0.5; font-size:0.7rem;">${artCount} items</span>`;
        allSec.appendChild(allTitle);
        
        var artworkList = document.createElement("div");
        artworkList.className = "exh-artwork-list";
        
        if (artCount === 0) {
            var p = document.createElement("p");
            p.style.opacity = "0.5";
            p.textContent = "Detailed artwork list is being compiled for this exhibition.";
            artworkList.appendChild(p);
        } else {
            exh.all_artworks.forEach(art => {
                var item = document.createElement("div");
                item.className = "exh-artwork-item";
                item.onclick = () => {
                    if (window.ArtworkDetail) {
                        window.ArtworkDetail.open(art.id === 0 ? null : art.id, art.wikidata_id);
                    }
                };
                
                var thumb = document.createElement("img");
                thumb.className = "exh-artwork-thumb";
                thumb.src = art.image_url || "";
                thumb.onerror = () => { thumb.style.display="none"; };
                
                var info = document.createElement("div");
                info.className = "exh-artwork-info";
                var h4 = document.createElement("h4");
                h4.textContent = art.title;
                var p = document.createElement("p");
                p.textContent = `${art.artist || "Unknown Artist"} • ${art.year || "n.d."}`;
                
                info.appendChild(h4);
                info.appendChild(p);
                item.appendChild(thumb);
                item.appendChild(info);
                artworkList.appendChild(item);
            });
        }
        allSec.appendChild(artworkList);
        mainCol.appendChild(allSec);
        content.appendChild(mainCol);

        // Sidebar
        var sideCol = document.createElement("div");

        // Exhibition Profile Tags
        var tagsSec = document.createElement("div");
        tagsSec.className = "exh-detail-section";
        var tagsTitle = document.createElement("div");
        tagsTitle.className = "exh-detail-section-title";
        tagsTitle.textContent = "Exhibition Profile";
        tagsSec.appendChild(tagsTitle);

        var hasTags = false;
        try {
            var movements = exh.movement_tags ? JSON.parse(exh.movement_tags) : [];
            var artists = exh.artist_tags ? JSON.parse(exh.artist_tags) : [];
            var allTags = [...movements, ...artists];
            if (allTags.length > 0) {
                hasTags = true;
                var tagsContainer = document.createElement("div");
                tagsContainer.className = "dossier-tag-list";
                allTags.forEach(t => {
                    var chip = document.createElement("span");
                    chip.className = "dossier-tag";
                    chip.textContent = t;
                    tagsContainer.appendChild(chip);
                });
                tagsSec.appendChild(tagsContainer);
            }
        } catch(e) {}
        
        if (hasTags) {
            sideCol.appendChild(tagsSec);
        }

        // Personalized Picks
        var picksSec = document.createElement("div");
        picksSec.className = "exh-detail-section";
        var picksTitle = document.createElement("div");
        picksTitle.className = "exh-detail-section-title";
        picksTitle.textContent = "Picks for You";
        picksSec.appendChild(picksTitle);

        if (exh.recommended_artists && exh.recommended_artists.length > 0) {
            var matchText = document.createElement("p");
            matchText.style.fontFamily = "var(--font-ui)";
            matchText.style.fontSize = "0.85rem";
            matchText.style.marginBottom = "1rem";
            matchText.innerHTML = "Based on your taste, you might enjoy works by:";
            picksSec.appendChild(matchText);

            var artistTags = document.createElement("div");
            artistTags.className = "exh-match-artists";
            exh.recommended_artists.forEach(artist => {
                var tag = document.createElement("span");
                tag.className = "exh-artist-tag";
                tag.textContent = artist;
                artistTags.appendChild(tag);
            });
            picksSec.appendChild(artistTags);
        }

        if (exh.recommended_artworks && exh.recommended_artworks.length > 0) {
            var worksTitle = document.createElement("p");
            worksTitle.style.fontFamily = "var(--font-ui)";
            worksTitle.style.fontSize = "0.85rem";
            worksTitle.style.marginTop = "2rem";
            worksTitle.style.marginBottom = "1rem";
            worksTitle.textContent = "Featured masterpieces you'll love:";
            picksSec.appendChild(worksTitle);

            var picksGrid = document.createElement("div");
            picksGrid.className = "exh-picks-grid";
            exh.recommended_artworks.forEach(art => {
                var pick = document.createElement("div");
                pick.className = "search-result-card"; // Reuse search result style
                pick.onclick = () => {
                    if (window.ArtworkDetail) {
                        window.ArtworkDetail.open(art.id === 0 ? null : art.id, art.wikidata_id);
                    }
                };
                
                var pickImg = document.createElement("img");
                pickImg.src = art.image_url || "";
                
                var pickInfo = document.createElement("div");
                pickInfo.className = "search-result-info";
                pickInfo.innerHTML = `<strong>${art.title}</strong><span>${art.artist}</span>`;
                
                pick.appendChild(pickImg);
                pick.appendChild(pickInfo);
                picksGrid.appendChild(pick);
            });
            picksSec.appendChild(picksGrid);
        }
        
        sideCol.appendChild(picksSec);

        // Status / Planning
        var planSec = document.createElement("div");
        planSec.className = "exh-detail-section";
        var planTitle = document.createElement("div");
        planTitle.className = "exh-detail-section-title";
        planTitle.textContent = "Your Plan";
        planSec.appendChild(planTitle);
        
        var statusSelect = document.createElement("div");
        statusSelect.style.display = "flex";
        statusSelect.style.flexDirection = "column";
        statusSelect.style.gap = "0.5rem";
        
        ["interested", "attending", "visited", "none"].forEach(s => {
            var b = document.createElement("button");
            b.className = "btn";
            b.style.width = "100%";
            if (exh.status === s || (s === "none" && !exh.status)) {
                b.style.background = s === "none" ? "rgba(255,255,255,0.1)" : "var(--accent)";
                b.style.color = s === "none" ? "var(--text-color)" : "white";
                b.style.borderColor = s === "none" ? "transparent" : "var(--accent)";
            }
            b.textContent = s === "none" ? "Clear Status" : s.charAt(0).toUpperCase() + s.slice(1);
            if (s === "none") b.style.opacity = "0.6";
            b.onclick = async () => {
                await window.API.patch(`/exhibitions/${exh.id}/status`, { status: s });
                this.open(exh.id); // Refresh
                if (window.EventsView) window.EventsView.loadExhibitions();
            };
            statusSelect.appendChild(b);
        });
        planSec.appendChild(statusSelect);

        // Notes Area
        var notesContainer = document.createElement("div");
        notesContainer.className = "log-form";
        notesContainer.style.marginTop = "1.5rem";
        
        var notesLabel = document.createElement("label");
        notesLabel.style.display = "block";
        notesLabel.style.fontFamily = "var(--font-ui)";
        notesLabel.style.fontSize = "0.85rem";
        notesLabel.style.marginBottom = "0.5rem";
        notesLabel.style.opacity = "0.7";
        notesLabel.textContent = "Personal Notes:";
        
        var notesArea = document.createElement("textarea");
        notesArea.rows = 4;
        notesArea.placeholder = "Jot down exhibition notes, ticket details, or impressions...";
        notesArea.value = exh.personal_notes || "";
        
        var saveNotesBtn = document.createElement("button");
        saveNotesBtn.className = "btn btn-sm btn-outline";
        saveNotesBtn.style.marginTop = "0.5rem";
        saveNotesBtn.textContent = "Save Notes";
        saveNotesBtn.onclick = async () => {
            var st = exh.status || "interested";
            if (st === "none") st = "interested"; // Require a status to save notes
            try {
                await window.API.patch(`/exhibitions/${exh.id}/status`, { status: st, notes: notesArea.value });
                saveNotesBtn.textContent = "Saved!";
                setTimeout(() => saveNotesBtn.textContent = "Save Notes", 2000);
                if (window.EventsView) window.EventsView.loadExhibitions();
            } catch(e) {
                alert("Failed to save notes");
            }
        };

        notesContainer.appendChild(notesLabel);
        notesContainer.appendChild(notesArea);
        notesContainer.appendChild(saveNotesBtn);
        planSec.appendChild(notesContainer);

        if (exh.status === 'visited') {
            var logBtn = document.createElement("button");
            logBtn.className = "btn btn-messy";
            logBtn.style.width = "100%";
            logBtn.style.marginTop = "1.5rem";
            logBtn.style.fontSize = "1rem";
            logBtn.textContent = "Log to Diary";
            logBtn.onclick = () => {
                alert("Navigating to Collection -> Visits...");
                document.querySelector('.modal-close').click();
                document.querySelector('.tab-link[onclick*="collection"]').click();
            };
            planSec.appendChild(logBtn);
        }
        sideCol.appendChild(planSec);

        content.appendChild(sideCol);
        layout.appendChild(content);
        container.appendChild(layout);
    }
};
