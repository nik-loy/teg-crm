window.CollectionView = {
    activeTab: "wishlist",
    render(container) {
        container.textContent = "";
        var tabs=document.createElement("div"); tabs.className="collection-tabs";
        ["wishlist","journal","visits"].forEach(function(tab) {
            var b=document.createElement("button"); b.className="sub-tab"+(tab==="wishlist"?" active":"");
            b.setAttribute("data-subtab",tab); b.textContent=tab.charAt(0).toUpperCase()+tab.slice(1);
            b.onclick=(function(t){return function(){window.CollectionView.switchTab(t);};})(tab); tabs.appendChild(b);
        });
        var cnt=document.createElement("div"); cnt.id="collection-content";
        container.appendChild(tabs); container.appendChild(cnt);
        this.switchTab(this.activeTab);
    },
    switchTab(tab) {
        this.activeTab=tab;
        document.querySelectorAll(".sub-tab").forEach(function(el){el.classList.toggle("active",el.getAttribute("data-subtab")===tab);});
        if(tab==="wishlist") this.loadWishlist();
        else if(tab==="journal") this.loadJournal();
        else this.loadVisits();
    },
    _grid(items, xfn) {
        var g=document.createElement("div"); g.className="masonry-grid";
        items.forEach(function(item){
            var card=document.createElement("div"); card.className="artwork-card";
            card.onclick=(function(id){return function(){window.viewArtworkDetails(null,id);};})(item.artwork_id||item.id);
            if(item.image_url){var img=document.createElement("img"); img.src=item.image_url; img.alt=item.title; card.appendChild(img);}
            var info=document.createElement("div"); info.className="artwork-card-info";
            var h4=document.createElement("h4"); h4.textContent=item.title||"Untitled";
            var pp=document.createElement("p"); pp.textContent=item.artist||"";
            info.appendChild(h4); info.appendChild(pp);
            if(xfn){var ex=xfn(item); if(ex) info.appendChild(ex);}
            card.appendChild(info); g.appendChild(card);
        });
        return g;
    },
    async loadWishlist() {
        var c=document.getElementById("collection-content"); if(!c) return; c.textContent="";
        try {
            var items=await window.API.get("/collection/wishlist");
            if(!items.length){var p=document.createElement("p"); p.textContent="Wishlist is empty."; c.appendChild(p); return;}
            c.appendChild(this._grid(items));
        } catch(e){var err=document.createElement("p"); err.textContent="Error."; c.appendChild(err);}
    },
    async loadJournal() {
        var c=document.getElementById("collection-content"); if(!c) return; c.textContent="";
        try {
            var items=await window.API.get("/collection/journal");
            if(!items.length){var p=document.createElement("p"); p.textContent="No artworks seen yet."; c.appendChild(p); return;}
            var stats=document.createElement("div"); stats.className="journal-stats";
            var s=document.createElement("strong"); s.textContent=items.length; stats.textContent="Total seen: "; stats.appendChild(s); c.appendChild(stats);
            c.appendChild(this._grid(items,function(item){
                if(!item.rating) return null;
                var span=document.createElement("span"); span.className="rating-stars"; span.textContent="★".repeat(item.rating); return span;
            }));
        } catch(e){var err=document.createElement("p"); err.textContent="Error."; c.appendChild(err);}
    },
    async loadVisits() {
        var c=document.getElementById("collection-content"); if(!c) return; c.textContent="";
        var ab=document.createElement("button"); ab.className="btn btn-outline"; ab.textContent="+ Log Museum Visit";
        ab.onclick=function(){window.CollectionView.openVisitModal();}; c.appendChild(ab);
        try {
            var visits=await window.API.get("/collection/visits");
            if(!visits.length){var p=document.createElement("p"); p.textContent="No visits logged yet."; c.appendChild(p); return;}
            var list=document.createElement("div"); list.className="visits-list";
            visits.forEach(function(v){
                var card=document.createElement("div"); card.className="visit-card";
                var h3=document.createElement("h3"); h3.textContent=v.museum_name||v.venue_name||"Unknown Museum";
                var m=document.createElement("p"); m.textContent=[v.city,v.country,v.visit_date].filter(Boolean).join(" · ");
                card.appendChild(h3); card.appendChild(m);
                if(v.notes){var n=document.createElement("p"); n.style.opacity="0.7"; n.textContent=v.notes; card.appendChild(n);}
                list.appendChild(card);
            });
            c.appendChild(list);
        } catch(e){var err=document.createElement("p"); err.textContent="Error."; c.appendChild(err);}
    },
    openVisitModal() {
        var body=document.getElementById("capture-body"); if(!body) return; body.textContent="";
        var h2=document.createElement("h2"); h2.textContent="Log Museum Visit"; body.appendChild(h2);
        var form=document.createElement("div"); form.style.cssText="display:flex;flex-direction:column;gap:1rem";
        [["visit-museum","text","Museum"],["visit-city","text","City"],["visit-country","text","Country"],["visit-date","date",""]].forEach(function(cf){
            var i=document.createElement("input"); i.type=cf[1]; i.id=cf[0]; i.className="search-input"; i.placeholder=cf[2]; form.appendChild(i);
        });
        var ta=document.createElement("textarea"); ta.id="visit-notes"; ta.className="search-input"; ta.placeholder="Notes..."; ta.rows=3; form.appendChild(ta);
        var btn=document.createElement("button"); btn.className="btn"; btn.textContent="Save Visit";
        btn.onclick=function(){window.CollectionView.submitVisit();}; form.appendChild(btn); body.appendChild(form);
        var m=document.getElementById("capture-modal"); if(m) m.classList.remove("hidden");
    },
    async submitVisit() {
        var museum=document.getElementById("visit-museum").value.trim(); if(!museum){alert("Museum required.");return;}
        try {
            await window.API.post("/visits",{museum_name:museum,city:document.getElementById("visit-city").value.trim()||null,
                country:document.getElementById("visit-country").value.trim()||null,
                visit_date:document.getElementById("visit-date").value||null,notes:document.getElementById("visit-notes").value.trim()||null});
            var m=document.getElementById("capture-modal"); if(m) m.classList.add("hidden"); this.loadVisits();
        } catch(e){alert("Failed.");}
    }
};