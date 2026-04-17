/**
 * GoodArts - Feed View: daily masterpiece hero + swipeable card stack
 */
window.FeedView = {
    feedData: [],
    currentIndex: 0,

    async render(container) {
        var hero = document.createElement("div"); hero.id = "daily-hero";
        var heading = document.createElement("h2"); heading.className = "section-heading"; heading.textContent = "Your Feed";
        var deck = document.createElement("div"); deck.id = "feed-deck"; deck.className = "feed-deck";
        var status = document.createElement("div"); status.id = "feed-status"; status.style.cssText = "text-align:center;padding:2rem;opacity:0.5";
        container.textContent = "";
        container.appendChild(hero); container.appendChild(heading); container.appendChild(deck); container.appendChild(status);
        this.loadDailyMasterpiece();
        this.loadFeed();
    },

    async loadDailyMasterpiece() {
        var hero = document.getElementById("daily-hero");
        if (!hero) return;
        try {
            var data = await window.API.get("/daily-masterpiece");
            var a = data.artwork;
            var heroDiv = document.createElement("div"); heroDiv.className = "daily-hero";
            if (a.image_url_hd || a.image_url) {
                var img = document.createElement("img"); img.src = a.image_url_hd || a.image_url;
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
    },

    async loadFeed() {
        var deck = document.getElementById("feed-deck");
        var status = document.getElementById("feed-status");
        if (!deck) return;
        try {
            this.feedData = await window.API.get("/feed?offset=0&limit=20");
            this.currentIndex = 0;
            if (this.feedData.length === 0) {
                this.loadPopularArtFallback(deck, status);
                return;
            }
            this.renderCurrentCard();
        } catch (e) {
            if (status) status.textContent = "Could not load feed.";
        }
    },

    async loadPopularArtFallback(deck, status) {
        if (status) status.textContent = "Exploring the canon\u2026";
        try {
            var data = await window.API.get("/explore");
            deck.textContent = "";
            if (status) status.textContent = "";
            var heading = document.createElement("h3");
            heading.style.cssText = "font-family:var(--font-heading);font-style:italic;opacity:0.55;font-size:1rem;text-align:center;margin-bottom:1.5rem;letter-spacing:0.03em;";
            heading.textContent = "The Canon \u2014 Art That Shaped History";
            deck.appendChild(heading);
            var grid = document.createElement("div");
            grid.className = "search-results-grid";
            (data.categories || []).forEach(function(cat) {
                (cat.artworks || []).slice(0, 4).forEach(function(a) {
                    var card = document.createElement("div");
                    card.className = "search-result-card";
                    card.onclick = function() { window.viewArtworkDetails && window.viewArtworkDetails(null, a.id); };
                    if (a.image_url || a.image_url_hd) {
                        var img = document.createElement("img");
                        img.src = a.image_url_hd || a.image_url; img.alt = a.title || ""; img.loading = "lazy";
                        card.appendChild(img);
                    }
                    var info = document.createElement("div"); info.className = "search-result-info";
                    var h4 = document.createElement("h4"); h4.textContent = a.title || "Untitled";
                    var p = document.createElement("p"); p.textContent = (a.artist || "Unknown") + (a.year ? " \u00b7 " + a.year : "");
                    info.appendChild(h4); info.appendChild(p); card.appendChild(info);
                    grid.appendChild(card);
                });
            });
            deck.appendChild(grid);
        } catch(e) {
            if (status) status.textContent = "You\u2019ve seen everything. Check back soon.";
        }
    },

    renderCurrentCard() {
        var deck = document.getElementById("feed-deck");
        if (!deck) return;
        if (this.currentIndex >= this.feedData.length) {
            deck.textContent = "";
            var p = document.createElement("p"); p.style.cssText = "text-align:center;padding:3rem;opacity:0.5";
            p.textContent = "You've seen them all! Check back later."; deck.appendChild(p); return;
        }
        var item = this.feedData[this.currentIndex];
        var a = item.artwork;
        var card = document.createElement("div"); card.className = "feed-card"; card.id = "current-feed-card";
        var imgDiv = document.createElement("div"); imgDiv.className = "feed-card-img";
        if (a.image_url_hd || a.image_url) {
            var img = document.createElement("img"); img.src = a.image_url_hd || a.image_url; img.alt = a.title; img.draggable = false; imgDiv.appendChild(img);
        }
        var info = document.createElement("div"); info.className = "feed-card-info";
        var h3 = document.createElement("h3"); h3.textContent = a.title;
        var p = document.createElement("p"); p.textContent = (a.artist || "Unknown") + (a.year ? " · " + a.year : "") + (a.movement ? " · " + a.movement : "");
        info.appendChild(h3); info.appendChild(p);
        var btns = document.createElement("div"); btns.className = "feed-card-actions";
        var self = this;
        [["btn-reject", "×", function(){self.swipe(-1);}], ["btn-detail", "?", function(){window.viewArtworkDetails(null,a.id);}],
         ["btn-like", "♥", function(){self.swipe(3);}], ["btn-love", "↑", function(){self.swipe(5);}]].forEach(function(cfg) {
            var b = document.createElement("button"); b.className = "btn-swipe " + cfg[0]; b.textContent = cfg[1]; b.onclick = cfg[2]; btns.appendChild(b);
        });
        card.appendChild(imgDiv); card.appendChild(info); card.appendChild(btns);

        // Build deck: hint label above card
        var hint = document.createElement("div"); hint.id = "swipe-hint";
        hint.style.cssText = "text-align:center;font-family:var(--font-ui);font-size:1.1rem;font-weight:600;height:1.8rem;letter-spacing:0.08em;transition:color 0.1s;";
        deck.textContent = ""; deck.appendChild(hint); deck.appendChild(card);

        // Attach swipe gestures if available
        var self = this;
        if (window.SwipeDeck) {
            window.SwipeDeck.attach(card, function(dir) {
                var weight = dir === "right" ? 3 : dir === "up" ? 5 : -1;
                self.swipe(weight);
            });
        }
    },

    async swipe(weight) {
        if (this.currentIndex >= this.feedData.length) return;
        var item = this.feedData[this.currentIndex];
        var a = item.artwork;
        var card = document.getElementById("current-feed-card");
        if (card) {
            var dir = weight > 0 ? 1 : -1;
            card.style.transition = "transform 0.4s ease, opacity 0.4s ease";
            card.style.transform = "translateX(" + (dir * 120) + "%) rotate(" + (dir * 15) + "deg)";
            card.style.opacity = "0";
        }
        var payload = { artwork_id: a.id, weight: weight };
        if (item.probe_type) { payload.probe_type = item.probe_type; payload.expected_signal = item.expected_signal; }
        window.API.post("/taste-profile/signal", payload).catch(function() {});
        if (weight === 5) window.API.post("/list/add", { artwork_id: a.id, list_type: "bucket" }).catch(function(){});
        if (weight >= 3) window.API.post("/list/add", { artwork_id: a.id, list_type: "seen", rating: weight }).catch(function(){});
        this.currentIndex++;
        var self = this;
        setTimeout(function() { self.renderCurrentCard(); window.updateNavStats && window.updateNavStats(); }, 400);
    }
};