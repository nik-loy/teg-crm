window.VisitDetail = (function () {

    function clearEl(el) {
        while (el.firstChild) el.removeChild(el.firstChild);
    }

    function makeEl(tag, className, text) {
        var el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }

    async function open(visitId) {
        var modal = document.getElementById('visit-modal');
        var body  = document.getElementById('visit-modal-body');
        var close = document.getElementById('visit-modal-close');
        if (!modal || !body) return;

        if (close) close.onclick = function() { modal.classList.add('hidden'); };

        clearEl(body);
        var loading = makeEl('div', null, 'Loading visit details\u2026');
        loading.style.cssText = 'text-align:center;padding:4rem;opacity:0.5;font-family:var(--font-ui)';
        body.appendChild(loading);
        modal.classList.remove('hidden');

        try {
            var visit = await window.API.get('/visits/' + visitId);
            renderVisit(body, visit);
            loadLogs(visit.id);
        } catch (e) {
            clearEl(body);
            body.appendChild(makeEl('p', null, 'Could not load visit details.'));
        }
    }

    function renderVisit(body, v) {
        clearEl(body);

        var header = makeEl('div', 'visit-detail-header');
        header.style.marginBottom = '2rem';

        var title = makeEl('h2', 'detail-title', v.venue_name || 'Museum Visit');
        title.style.marginBottom = '0.5rem';
        header.appendChild(title);

        var meta = makeEl('p', 'detail-artist');
        meta.textContent = [v.city, v.country, v.visit_date].filter(Boolean).join(' \u00b7 ');
        header.appendChild(meta);

        if (v.overall_notes) {
            var notesWrap = makeEl('div', null);
            notesWrap.style.cssText = 'margin: 1.5rem 0; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 12px; font-style: italic;';
            notesWrap.textContent = v.overall_notes;
            header.appendChild(notesWrap);
        }

        body.appendChild(header);

        var content = makeEl('div', 'visit-detail-content');
        content.style.display = 'grid';
        content.style.gridTemplateColumns = '1fr';
        content.style.gap = '2rem';

        var logsSection = makeEl('div', 'logs-section');
        var logsLabel = makeEl('h3', null, 'My Visit Logs & Memories');
        logsLabel.style.cssText = 'font-family:var(--font-ui);font-size:0.75rem;text-transform:uppercase;letter-spacing:0.12em;opacity:0.4;margin-bottom:1rem;';
        logsSection.appendChild(logsLabel);

        var logsList = makeEl('div', 'logs-list');
        logsList.id = 'visit-logs-list';
        logsSection.appendChild(logsList);

        var logForm = makeEl('div', 'log-form');
        logForm.style.marginTop = '1.5rem';
        var logInput = makeEl('textarea', 'search-input', '');
        logInput.id = 'visit-log-content';
        logInput.placeholder = 'What did you see? Any special feelings or discoveries?';
        logInput.rows = 3;
        logInput.style.width = '100%';
        logForm.appendChild(logInput);

        var logBtn = makeEl('button', 'btn', 'Add Log Entry');
        logBtn.style.marginTop = '0.75rem';
        logBtn.onclick = async function() {
            var val = logInput.value.trim();
            if (!val) return;
            try {
                await window.API.createLog({ visit_id: v.id, content: val });
                logInput.value = '';
                loadLogs(v.id);
            } catch(e) { alert('Failed to save log.'); }
        };
        logForm.appendChild(logBtn);
        logsSection.appendChild(logForm);

        content.appendChild(logsSection);
        body.appendChild(content);
    }

    async function loadLogs(visitId) {
        var list = document.getElementById('visit-logs-list');
        if (!list) return;
        try {
            var logs = await window.API.getLogs({ visit_id: visitId });
            clearEl(list);
            if (!logs.length) {
                list.appendChild(makeEl('p', null, 'No entries yet. Log something special from your visit!'));
                list.lastChild.style.opacity = '0.4';
                list.lastChild.style.fontSize = '0.85rem';
                return;
            }
            logs.forEach(function(log) {
                var item = makeEl('div', 'log-item');
                item.style.cssText = 'padding:1rem;background:rgba(255,255,255,0.03);border-radius:12px;margin-bottom:0.75rem;font-size:0.95rem;position:relative;border-left:2px solid var(--accent-gold, #d4af37);';
                
                var date = makeEl('div', null, new Date(log.created_at).toLocaleTimeString() + ' \u00b7 ' + new Date(log.created_at).toLocaleDateString());
                date.style.cssText = 'font-size:0.7rem;opacity:0.4;margin-bottom:0.5rem;';
                item.appendChild(date);
                
                var txt = makeEl('div', null, log.content);
                item.appendChild(txt);

                var del = makeEl('span', null, '\u00d7');
                del.style.cssText = 'position:absolute;top:0.75rem;right:0.75rem;cursor:pointer;opacity:0.3;font-size:1.2rem;';
                del.onclick = async function() {
                    if(confirm('Delete this entry?')) {
                        await window.API.deleteLog(log.id);
                        loadLogs(visitId);
                    }
                };
                item.appendChild(del);

                list.appendChild(item);
            });
        } catch(e) {}
    }

    return { open: open };
}());

window.viewVisitDetails = function (visitId) {
    window.VisitDetail.open(visitId);
};
