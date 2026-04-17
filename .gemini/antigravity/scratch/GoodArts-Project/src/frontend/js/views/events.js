window.EventsView = {
    currentCity: null,
    async render(container) {
        container.textContent = "";
        var h2 = document.createElement("h2"); h2.textContent = "Exhibitions";
        var ci = document.createElement("input"); ci.id="events-city"; ci.className="search-input"; ci.placeholder="City...";
        var go = document.createElement("button"); go.className="btn btn-outline"; go.textContent="Go";
        go.onclick = function() { window.EventsView.loadCity(); };
        var hdr = document.createElement("div"); hdr.className="events-header";
        hdr.appendChild(h2); hdr.appendChild(ci); hdr.appendChild(go);
        var cnt = document.createElement("div"); cnt.id="events-content";
        var add = document.createElement("button"); add.className="btn btn-outline"; add.textContent="+ Add Exhibition";
        add.onclick = function() { window.EventsView.openAddModal(); };
        container.appendChild(hdr); container.appendChild(cnt); container.appendChild(add);
        try { var s=await window.API.get("/settings"); this.currentCity=s.home_city||""; ci.value=this.currentCity; } catch(e){}
        this.loadExhibitions();
    },
    async loadCity() { var i=document.getElementById("events-city"); if(i) this.currentCity=i.value.trim(); this.loadExhibitions(); },
    async loadExhibitions() {
        var cnt=document.getElementById("events-content"); if(!cnt) return; cnt.textContent="";
        try {
            var url="/exhibitions"+(this.currentCity?"?city="+encodeURIComponent(this.currentCity):"");
            var exhs=await window.API.get(url);
            if(!exhs.length){var p=document.createElement("p");p.textContent="No exhibitions found.";cnt.appendChild(p);return;}
            var grid=document.createElement("div"); grid.className="exhibitions-grid";
            exhs.forEach(function(exh) {
                var card=document.createElement("div"); card.className="exhibition-card";
                var info=document.createElement("div"); info.className="exh-info";
                var h3=document.createElement("h3"); h3.textContent=exh.title;
                var vn=document.createElement("p"); vn.textContent=exh.venue_name||"";
                var dt=document.createElement("p"); dt.textContent=(exh.start_date||"?")+" - "+(exh.end_date||"?");
                info.appendChild(h3); info.appendChild(vn); info.appendChild(dt);
                var acts=document.createElement("div"); acts.className="exh-actions";
                ["interested","attending","visited"].forEach(function(s) {
                    var b=document.createElement("button"); b.className="btn btn-sm"; b.textContent=s.charAt(0).toUpperCase()+s.slice(1);
                    b.onclick=(function(id,st){return function(){window.EventsView.setStatus(id,st);};})(exh.id,s); acts.appendChild(b);
                });
                card.appendChild(info); card.appendChild(acts); grid.appendChild(card);
            });
            cnt.appendChild(grid);
        } catch(e) { var err=document.createElement("p"); err.textContent="Error loading."; cnt.appendChild(err); }
    },
    async setStatus(id,st) { try { await window.API.patch("/exhibitions/"+id+"/status",{status:st}); this.loadExhibitions(); } catch(e){alert("Failed.");} },
    openAddModal() {
        var body=document.getElementById("capture-body"); if(!body) return; body.textContent="";
        var h2=document.createElement("h2"); h2.textContent="Add Exhibition"; body.appendChild(h2);
        var form=document.createElement("div"); form.style.cssText="display:flex;flex-direction:column;gap:1rem";
        [["add-exh-title","text","Title"],["add-exh-venue","text","Venue"],["add-exh-city","text","City"],
         ["add-exh-start","date",""],["add-exh-end","date",""]].forEach(function(cf){
            var i=document.createElement("input"); i.type=cf[1]; i.id=cf[0]; i.className="search-input"; i.placeholder=cf[2]; form.appendChild(i);
        });
        var btn=document.createElement("button"); btn.className="btn"; btn.textContent="Add";
        btn.onclick=function(){window.EventsView.submitExhibition();}; form.appendChild(btn); body.appendChild(form);
        var m=document.getElementById("capture-modal"); if(m) m.classList.remove("hidden");
    },
    async submitExhibition() {
        var t=document.getElementById("add-exh-title").value.trim(); if(!t){alert("Title required.");return;}
        try {
            await window.API.post("/exhibitions",{title:t,venue_name:document.getElementById("add-exh-venue").value.trim()||null,
                city:document.getElementById("add-exh-city").value.trim()||null,
                start_date:document.getElementById("add-exh-start").value||null,end_date:document.getElementById("add-exh-end").value||null});
            var m=document.getElementById("capture-modal"); if(m) m.classList.add("hidden"); this.loadExhibitions();
        } catch(e){alert("Failed.");}
    }
};