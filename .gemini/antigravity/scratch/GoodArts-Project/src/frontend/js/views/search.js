/**
 * GoodArts — Search View (Multi-Provider)
 */
window.SearchView = {
    render(container) {
        container.innerHTML =
            "<input type="text" id="search-input" class="search-input" placeholder="Search artists, titles, movements..." autocomplete="off">" +
            "<div id="search-status" class="mb-2" style="opacity:0.6"></div>" +
            "<div id="search-results" class="masonry-grid mb-2"></div>" +
            "<h2 class="section-heading mt-2">Browse Collections</h2>" +
            "<div id="explore-collections"></div>";

        var input = document.getElementById("search-input");
        var timeout = null;
        var self = this;

        input.addEventListener("input", function(e) {
            clearTimeout(timeout);
            var q = e.target.value.trim();
            if (q.length < 2) {
                document.getElementById("search-results").innerHTML = "";
                document.getElementById("search-status").innerText = "";
                return;
            }
            document.getElementById("search-status").innerText = "Searching archives...";
            timeout = setTimeout(function() { self.performSearch(q); }, 600);
        });

        setTimeout(function() { input.focus(); }, 100);
        this.loadCollections();
    },

    async performSearch(q) {
        try {
            var data = await window.API.get("/search?q=" + encodeURIComponent(q));
            var total = data.local.length + data.remote.length;
            document.getElementById("search-status").innerText = "Found " + total + " results.";

            var all = data.local.concat(data.remote);
            document.getElementById("search-results").innerHTML =
                all.map(function(a) { return window.Components.ArtworkCard(a); }).join("") ||
                "<p>No results found.</p>";
        } catch (e) {
            document.getElementById("search-status").innerText = "Search failed.";
        }
    },

    async loadCollections() {
        var el = document.getElementById("explore-collections");
        if (!el) return;
        try {
            var data = await window.API.get("/explore");
            var html = "";
            data.categories.forEach(function(cat) {
                if (cat.artworks.length > 0) {
                    html += "<h3 class="section-subheading">" + cat.name + "</h3>" +
                        "<div class="masonry-grid mb-2">" +
                        cat.artworks.map(function(a) { return window.Components.ArtworkCard(a); }).join("") +
                        "</div>";
                }
            });
            el.innerHTML = html || "<p style="opacity: 0.5;">No collections available.</p>";
        } catch (e) {
            el.innerHTML = "";
        }
    }
};
