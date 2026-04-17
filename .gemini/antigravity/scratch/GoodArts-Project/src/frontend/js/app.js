/**
 * GoodArts — Main Router & App Initialization
 */
document.addEventListener("DOMContentLoaded", async () => {
    const onboardingDone = localStorage.getItem("artlog_onboarding_done") === "1";

    if (!onboardingDone) {
        try {
            const profile = await window.API.get("/taste-profile");
            if (Object.keys(profile).length === 0) {
                window.Onboarding && window.Onboarding.init();
                updateNavStats();
                return;
            }
        } catch (e) {
            console.warn("Could not fetch taste profile, skipping onboarding check.");
        }
    }

    window.initRouter();
    updateNavStats();

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/static/sw.js").catch(function() {});
    }
});

function initRouter() {
    window.initRouter = _initRouter;
    _initRouter();
}
window.initRouter = initRouter;

function _initRouter() {
    window.addEventListener("hashchange", handleRouteChange);
    handleRouteChange();
}

function handleRouteChange() {
    var hash = window.location.hash || "#feed";
    var viewName = hash.substring(1);
    document.querySelectorAll(".view-section").forEach(function(el) { el.classList.remove("active"); });
    document.querySelectorAll(".tab-link").forEach(function(el) {
        el.classList.toggle("active", el.getAttribute("href") === hash);
    });
    var container = document.getElementById("view-" + viewName);
    if (!container) {
        container = document.createElement("div");
        container.id = "view-" + viewName;
        container.className = "view-section";
        document.getElementById("app-container").appendChild(container);
    }
    container.classList.add("active");
    document.body.setAttribute("data-tab", viewName);
    switch (viewName) {
        case "feed":       window.FeedView       && window.FeedView.render(container);       break;
        case "events":     window.EventsView     && window.EventsView.render(container);     break;
        case "search":     window.SearchView     && window.SearchView.render(container);     break;
        case "collection": window.CollectionView && window.CollectionView.render(container); break;
    }
}

async function updateNavStats() {
    try {
        var stats = await window.API.get("/stats");
        var el = document.getElementById("nav-stats");
        if (el) {
            el.textContent = "";
            var s1 = document.createElement("span"); s1.className = "nav-stat";
            s1.textContent = "SEEN "; var b1 = document.createElement("strong"); b1.textContent = stats.seen_count; s1.appendChild(b1);
            var s2 = document.createElement("span"); s2.className = "nav-stat";
            s2.textContent = "WANT "; var b2 = document.createElement("strong"); b2.textContent = stats.bucket_count; s2.appendChild(b2);
            el.appendChild(s1); el.appendChild(s2);
        }
    } catch (e) { /* silent */ }
}
window.updateNavStats = updateNavStats;

window.closeModal = function() {
    var modal = document.getElementById("artwork-modal");
    if (modal) modal.classList.add("hidden");
};

document.addEventListener("DOMContentLoaded", function() {
    var closeBtn = document.getElementById("modal-close");
    if (closeBtn) closeBtn.addEventListener("click", window.closeModal);
    var modal = document.getElementById("artwork-modal");
    if (modal) modal.addEventListener("click", function(e) { if (e.target === modal) window.closeModal(); });
    var fab = document.getElementById("fab-capture");
    if (fab) fab.addEventListener("click", function() { window.PhotoUpload && window.PhotoUpload.openCapture(); });
});

window.addToList = async function(artworkId, listType) {
    try {
        await window.API.post("/list/add", { artwork_id: artworkId, list_type: listType });
        window.updateNavStats && window.updateNavStats();
    } catch (e) { console.error("Failed to add to list:", e); }
};
