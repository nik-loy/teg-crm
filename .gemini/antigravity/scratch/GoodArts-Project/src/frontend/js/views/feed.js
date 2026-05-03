/**
 * GoodArts - Feed View: daily masterpiece hero + infinite-scroll feed
 */
window.FeedView = {
    async render(container) {
        container.textContent = "";

        // Daily hero section
        var hero = document.createElement("div");
        hero.id = "daily-hero";
        container.appendChild(hero);

        // Feed section heading
        var feedSection = document.createElement("div");
        feedSection.className = "feed-section";

        var heading = document.createElement("h2");
        heading.className = "section-heading";
        heading.textContent = "Your Feed";
        feedSection.appendChild(heading);

        // Infinite scroll container
        var feedContainer = document.createElement("div");
        feedContainer.id = "infinite-scroll-container";
        feedContainer.className = "infinite-scroll-container";
        feedSection.appendChild(feedContainer);

        container.appendChild(feedSection);

        // Load daily masterpiece
        this.loadDailyMasterpiece();

        // Render infinite-scroll feed
        if (window.InfiniteScrollFeed) {
            await window.InfiniteScrollFeed.render(feedContainer);
        }
    },

    async loadDailyMasterpiece() {
        var hero = document.getElementById("daily-hero");
        if (!hero) return;
        try {
            var data = await window.API.get("/daily-masterpiece");
            var a = data.artwork;
            var heroDiv = document.createElement("div"); heroDiv.className = "daily-hero";
            if (a.image_url_hd || a.image_url) {
                var img = document.createElement("img"); 
                img.src = window.API.proxyImage(a.image_url_hd || a.image_url);
                img.className = "hero-image"; img.alt = a.title; heroDiv.appendChild(img);
            }
            var overlay = document.createElement("div"); overlay.className = "hero-overlay";
            var badge = document.createElement("div"); badge.className = "hero-badge"; badge.textContent = "Daily Masterpiece";
            var title = document.createElement("h1"); title.className = "hero-title"; title.textContent = a.title;
            var meta = document.createElement("p"); meta.className = "hero-meta";
            meta.textContent = (a.artist || "Unknown") + (a.year ? " (" + a.year + ")" : "");
            overlay.appendChild(badge); overlay.appendChild(title); overlay.appendChild(meta);
            if (data.fun_facts && data.fun_facts.length > 0) {
                var factsDiv = document.createElement("div"); factsDiv.className = "hero-facts";
                data.fun_facts.forEach(function(f) {
                    var p = document.createElement("p"); p.className = "hero-fact"; p.textContent = f; factsDiv.appendChild(p);
                });
                overlay.appendChild(factsDiv);
            }
            var actions = document.createElement("div"); actions.className = "hero-actions";
            var btn1 = document.createElement("button"); btn1.className = "btn btn-outline"; btn1.textContent = "Save to Wishlist";
            btn1.onclick = function() { window.addToList(a.id, "bucket"); };
            var btn2 = document.createElement("button"); btn2.className = "btn btn-outline"; btn2.textContent = "Learn More";
            btn2.onclick = function() { window.viewArtworkDetails(null, a.id); };
            actions.appendChild(btn1); actions.appendChild(btn2); overlay.appendChild(actions);
            heroDiv.appendChild(overlay); hero.textContent = ""; hero.appendChild(heroDiv);
        } catch (e) { hero.textContent = ""; }
    }
};