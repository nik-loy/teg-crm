window.EventsView = {
    currentCity: null,
    async render(container) {
        container.textContent = "";
        
        var header = document.createElement("div");
        header.className = "events-header";
        
        var title = document.createElement("h2");
        title.textContent = "Exhibitions";
        
        var searchGroup = document.createElement("div");
        searchGroup.style.display = "flex";
        searchGroup.style.gap = "0.5rem";
        
        var cityInput = document.createElement("input");
        cityInput.id = "events-city";
        cityInput.className = "search-input";
        cityInput.placeholder = "Search City...";
        
        var goBtn = document.createElement("button");
        goBtn.className = "btn btn-outline";
        goBtn.textContent = "Go";
        goBtn.onclick = () => this.loadCity();
        
        searchGroup.appendChild(cityInput);
        searchGroup.appendChild(goBtn);
        
        header.appendChild(title);
        header.appendChild(searchGroup);
        
        var addBtn = document.createElement("button");
        addBtn.className = "btn btn-outline";
        addBtn.textContent = "+ Add";
        addBtn.onclick = () => this.openAddModal();
        header.appendChild(addBtn);

        var content = document.createElement("div");
        content.id = "events-content";
        
        container.appendChild(header);
        container.appendChild(content);

        try {
            var settings = await window.API.get("/settings");
            this.currentCity = settings.home_city || "";
            cityInput.value = this.currentCity;
        } catch(e) {}
        
        this.loadExhibitions();
    },

    async loadCity() {
        var input = document.getElementById("events-city");
        if (input) this.currentCity = input.value.trim();
        this.loadExhibitions();
    },

    async loadExhibitions() {
        var container = document.getElementById("events-content");
        if (!container) return;
        var cityName = this.currentCity || "your area";
        container.innerHTML = `<p style="opacity:0.5">Searching for exhibitions in ${cityName}...</p>`;

        try {
            var url = "/exhibitions" + (this.currentCity ? "?city=" + encodeURIComponent(this.currentCity) : "");
            var exhs = await window.API.get(url);
            
            container.textContent = "";
            if (!exhs.length) {
                var empty = document.createElement("div");
                empty.style.cssText = "text-align:center; padding: 3rem 1rem; opacity:0.6;";
                var emptyMsg = document.createElement("p");
                emptyMsg.textContent = "No exhibitions found in this city.";
                emptyMsg.style.marginBottom = "1.5rem";
                empty.appendChild(emptyMsg);
                var sugg = document.createElement("div");
                sugg.style.cssText = "display:flex; flex-wrap:wrap; gap:0.5rem; justify-content:center;";
                var suggLabel = document.createElement("span");
                suggLabel.textContent = "Try: ";
                suggLabel.style.opacity = "0.5";
                sugg.appendChild(suggLabel);
                ["London", "New York", "Paris", "Amsterdam", "São Paulo", "Berlin"].forEach(c => {
                    var chip = document.createElement("button");
                    chip.className = "btn btn-sm btn-outline";
                    chip.textContent = c;
                    chip.onclick = () => {
                        this.currentCity = c;
                        var inp = document.getElementById("events-city");
                        if (inp) inp.value = c;
                        this.loadExhibitions();
                    };
                    sugg.appendChild(chip);
                });
                empty.appendChild(sugg);
                container.appendChild(empty);
                return;
            }

            // Categorize Exhibitions
            const today = new Date().toISOString().split('T')[0];
            
            const recommended = [];
            const comingSoon = [];
            const current = [];
            
            // Avoid duplicates across sections. Recommended takes precedence.
            exhs.forEach(exh => {
                if (exh.taste_affinity >= 0.5) {
                    recommended.push(exh);
                } else if (exh.start_date && exh.start_date > today) {
                    comingSoon.push(exh);
                } else {
                    current.push(exh);
                }
            });
            
            // Sort arrays
            recommended.sort((a, b) => b.taste_affinity - a.taste_affinity);
            comingSoon.sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
            current.sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));

            const renderGrid = (title, items) => {
                if (items.length === 0) return null;
                
                var section = document.createElement("div");
                section.className = "exh-list-section";
                section.style.marginBottom = "3rem";
                
                var heading = document.createElement("h3");
                heading.textContent = title;
                heading.style.cssText = "font-size:1.5rem; margin-bottom:1rem; font-style:italic; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.5rem;";
                section.appendChild(heading);
                
                var grid = document.createElement("div");
                grid.className = "exhibitions-grid";

                items.forEach(exh => {
                    var card = document.createElement("div");
                    card.className = "exhibition-card";
                    card.setAttribute("data-exhibition-id", exh.id);

                    // Image
                    var imgContainer = document.createElement("div");
                    imgContainer.className = "exh-image-container";
                    var img = document.createElement("img");
                    img.className = "exh-image";
                    img.src = exh.image_url || "/static/img/placeholder-exh.jpg";
                    img.onerror = () => { img.src = "https://images.unsplash.com/photo-1544413647-ad3481aa520b?auto=format&fit=crop&q=80&w=800"; };
                    imgContainer.appendChild(img);
                    
                    var statusBadge = document.createElement("div");
                    statusBadge.className = "exh-status-badge";
                    statusBadge.style.display = (exh.status && exh.status !== 'none') ? "block" : "none";
                    statusBadge.textContent = exh.status ? exh.status.toUpperCase() : "";
                    imgContainer.appendChild(statusBadge);
                    card.appendChild(imgContainer);

                    // Info
                    var info = document.createElement("div");
                    info.className = "exh-info";
                    var cTitle = document.createElement("h3");
                    cTitle.textContent = exh.title;
                    var venue = document.createElement("div");
                    venue.className = "exh-venue";
                    venue.textContent = exh.venue_name || "Exhibition";
                    var dates = document.createElement("div");
                    dates.className = "exh-dates";
                    dates.textContent = (exh.start_date || "?") + " — " + (exh.end_date || "?");
                    
                    info.appendChild(cTitle);
                    info.appendChild(venue);
                    info.appendChild(dates);
                    
                    if (exh.taste_affinity >= 0.5) {
                        var aff = document.createElement("div");
                        aff.className = "exh-affinity";
                        aff.textContent = Math.round(exh.taste_affinity * 100) + "% MATCH";
                        info.appendChild(aff);
                    }
                    card.appendChild(info);

                    // Actions (3-state selector)
                    var actions = document.createElement("div");
                    actions.className = "exh-actions";
                    
                    var select = document.createElement("select");
                    select.className = "search-input";
                    select.style.padding = "0.4rem 0.5rem";
                    select.style.fontSize = "0.8rem";
                    select.style.width = "auto";
                    select.style.flex = "1";
                    
                    const options = [
                        { value: "none", text: "Set Status..." },
                        { value: "interested", text: "Interested" },
                        { value: "attending", text: "Attending" },
                        { value: "visited", text: "Visited" }
                    ];
                    
                    options.forEach(opt => {
                        var el = document.createElement("option");
                        el.value = opt.value;
                        el.textContent = opt.text;
                        if (exh.status === opt.value) el.selected = true;
                        select.appendChild(el);
                    });
                    
                    select.onclick = (e) => e.stopPropagation();
                    select.onchange = async (e) => {
                        e.stopPropagation();
                        var newStatus = e.target.value;
                        statusBadge.textContent = newStatus === 'none' ? "" : newStatus.toUpperCase();
                        statusBadge.style.display = newStatus === 'none' ? "none" : "block";
                        
                        try {
                            await window.API.patch(`/exhibitions/${exh.id}/status`, { status: newStatus });
                        } catch(err) {
                            alert("Failed to update status.");
                        }
                    };

                    var btnGo = document.createElement("button");
                    btnGo.className = "btn btn-sm btn-outline";
                    btnGo.textContent = "Map";
                    btnGo.onclick = (e) => {
                        e.stopPropagation();
                        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(exh.venue_name + ' ' + (exh.city || ""))}`, "_blank");
                    };

                    actions.appendChild(select);
                    actions.appendChild(btnGo);
                    card.appendChild(actions);

                    grid.appendChild(card);
                });

                // Event Delegation
                grid.addEventListener("click", (e) => {
                    var card = e.target.closest(".exhibition-card");
                    if (card && !e.target.closest(".exh-actions")) {
                        var id = card.getAttribute("data-exhibition-id");
                        if (window.ExhibitionDetailView) {
                            window.ExhibitionDetailView.open(id);
                        }
                    }
                });
                
                section.appendChild(grid);
                return section;
            };

            const sections = [
                renderGrid("Recommended For You", recommended),
                renderGrid("Coming Soon", comingSoon),
                renderGrid("All Current Shows", current)
            ];
            
            sections.forEach(sec => {
                if (sec) container.appendChild(sec);
            });

        } catch(e) {
            container.innerHTML = '<p style="color:var(--accent)">Failed to load exhibitions.</p>';
            console.error(e);
        }
    },

    async setStatus(id, st) {
        try {
            await window.API.patch(`/exhibitions/${id}/status`, { status: st });
            this.loadExhibitions();
        } catch(e) {
            alert("Could not update status.");
        }
    },

    openAddModal() {
        var body = document.getElementById("capture-body");
        if (!body) return;
        body.textContent = "";
        
        var h2 = document.createElement("h2");
        h2.textContent = "New Exhibition";
        h2.style.fontStyle = "italic";
        h2.style.marginBottom = "2rem";
        body.appendChild(h2);
        
        var form = document.createElement("div");
        form.style.cssText = "display:flex;flex-direction:column;gap:1.5rem";
        
        var fields = [
            { id: "add-exh-title", type: "text", label: "Exhibition Title" },
            { id: "add-exh-venue", type: "text", label: "Museum / Venue" },
            { id: "add-exh-city", type: "text", label: "City" },
            { id: "add-exh-start", type: "date", label: "Start Date" },
            { id: "add-exh-end", type: "date", label: "End Date" }
        ];

        fields.forEach(f => {
            var group = document.createElement("div");
            var label = document.createElement("label");
            label.textContent = f.label;
            label.style.display = "block";
            label.style.fontSize = "0.75rem";
            label.style.opacity = "0.5";
            label.style.marginBottom = "0.5rem";
            
            var i = document.createElement("input");
            i.type = f.type;
            i.id = f.id;
            i.className = "search-input";
            
            group.appendChild(label);
            group.appendChild(i);
            form.appendChild(group);
        });

        var btn = document.createElement("button");
        btn.className = "btn-messy";
        btn.textContent = "Save Event";
        btn.style.marginTop = "1rem";
        btn.onclick = () => this.submitExhibition();
        form.appendChild(btn);
        
        body.appendChild(form);
        var m = document.getElementById("capture-modal");
        if (m) m.classList.remove("hidden");
    },

    async submitExhibition() {
        var title = document.getElementById("add-exh-title").value.trim();
        if (!title) { alert("Please enter a title."); return; }
        
        try {
            await window.API.post("/exhibitions", {
                title: title,
                venue_name: document.getElementById("add-exh-venue").value.trim() || null,
                city: document.getElementById("add-exh-city").value.trim() || null,
                start_date: document.getElementById("add-exh-start").value || null,
                end_date: document.getElementById("add-exh-end").value || null
            });
            document.getElementById("capture-modal").classList.add("hidden");
            this.loadExhibitions();
        } catch(e) {
            alert("Failed to save.");
        }
    }
};