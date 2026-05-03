/**
 * GoodArts — Infinite Scroll Feed View
 *
 * Features:
 * - Vertical scroll with full-viewport artwork items (~90-95vh each)
 * - Sticky metadata bar with title, artist, year, movement
 * - Swipe gestures: left (-1) / right (3) on image, does NOT trigger on buttons
 * - Buttons: PASS, LIKE, LEARN MORE, FULLSCREEN (desktop only)
 * - Visual feedback: swiped artwork fades & grays, can be un-swiped
 * - Intersection Observer for infinite load
 * - Fullscreen modal: ESC/backdrop closes, mobile hides button via CSS
 */

window.InfiniteScrollFeed = {
    feedData: [],
    currentIndex: 0,
    loadingMore: false,
    observerSetup: false,
    signalState: {},
    pendingSignals: {},
    containerEl: null,

    async render(container) {
        this.containerEl = container;
        this.feedData = [];
        this.currentIndex = 0;
        this.loadingMore = false;
        this.signalState = {};
        this.observerSetup = false;

        var feedContainer = document.createElement('div');
        feedContainer.id = 'infinite-feed-container';
        feedContainer.style.cssText = 'display:flex;flex-direction:column;';

        var feedList = document.createElement('div');
        feedList.id = 'infinite-feed-list';
        feedList.style.cssText = 'display:flex;flex-direction:column;';

        feedContainer.appendChild(feedList);
        container.textContent = '';
        container.appendChild(feedContainer);

        await this.loadMore();
    },

    async loadMore() {
        if (this.loadingMore) return;
        this.loadingMore = true;

        try {
            var offset = this.feedData.length;
            var limit = 10;
            var batch = await window.API.get('/feed?offset=' + offset + '&limit=' + limit);

            if (!batch || batch.length === 0) {
                this.loadingMore = false;
                return;
            }

            this.feedData = this.feedData.concat(batch);

            var feedList = document.getElementById('infinite-feed-list');
            if (!feedList) {
                this.loadingMore = false;
                return;
            }

            var self = this;
            batch.forEach(function(artwork, idx) {
                var itemEl = self.renderArtworkItem(artwork, offset + idx);
                feedList.appendChild(itemEl);
            });

            if (!this.observerSetup) {
                this.setupIntersectionObserver(feedList);
                this.observerSetup = true;
            } else {
                var lastItem = feedList.lastElementChild;
                if (lastItem && window.feedObserver) {
                    window.feedObserver.observe(lastItem);
                }
            }

            this.loadingMore = false;
        } catch (e) {
            console.error('Failed to load feed batch:', e);
            this.loadingMore = false;
        }
    },

    renderArtworkItem(item, index) {
        var a = item.artwork;
        var artworkId = a.id;
        var self = this;

        var itemEl = document.createElement('div');
        itemEl.className = 'feed-item';
        itemEl.id = 'feed-item-' + artworkId;
        itemEl.dataset.artworkId = artworkId;
        itemEl.style.cssText = 'position:relative;height:75vh;overflow:hidden;background:#0b0a0a;border-bottom:1px solid rgba(255,255,255,0.05);';

        // Image fills the full viewport height — absolutely positioned behind overlay
        var imgContainer = document.createElement('div');
        imgContainer.className = 'feed-item-image-container';
        imgContainer.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;cursor:grab;transition:opacity 0.3s,filter 0.3s;background:#0b0a0a;z-index:0;padding:5vh 8vw 16vh;';

        function makePlaceholder(titleText) {
            var wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.75rem;opacity:0.2;';
            var svgNS = 'http://www.w3.org/2000/svg';
            var svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('width', '64'); svg.setAttribute('height', '64'); svg.setAttribute('viewBox', '0 0 64 64');
            var rect = document.createElementNS(svgNS, 'rect');
            rect.setAttribute('x','8'); rect.setAttribute('y','8'); rect.setAttribute('width','48'); rect.setAttribute('height','48');
            rect.setAttribute('rx','1'); rect.setAttribute('stroke','#e8e3dc'); rect.setAttribute('stroke-width','1.5'); rect.setAttribute('fill','none');
            var circle = document.createElementNS(svgNS, 'circle');
            circle.setAttribute('cx','22'); circle.setAttribute('cy','24'); circle.setAttribute('r','4');
            circle.setAttribute('stroke','#e8e3dc'); circle.setAttribute('stroke-width','1.5'); circle.setAttribute('fill','none');
            var path = document.createElementNS(svgNS, 'path');
            path.setAttribute('d','M8 42 L20 30 L30 40 L40 28 L56 44');
            path.setAttribute('stroke','#e8e3dc'); path.setAttribute('stroke-width','1.5'); path.setAttribute('fill','none');
            svg.appendChild(rect); svg.appendChild(circle); svg.appendChild(path);
            var label = document.createElement('span');
            label.style.cssText = 'font-family:var(--font-ui,sans-serif);font-size:0.65rem;letter-spacing:0.2em;text-transform:uppercase;color:#e8e3dc;text-align:center;max-width:200px;';
            label.textContent = titleText || 'Artwork';
            wrap.appendChild(svg); wrap.appendChild(label);
            return wrap;
        }

        if (a.image_url_hd || a.image_url) {
            var img = document.createElement('img');
            img.src = window.API.proxyImage(a.image_url_hd || a.image_url);
            img.alt = a.title || 'Artwork';
            img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;user-select:none;pointer-events:none;display:block;';
            img.onerror = function() {
                if (img.parentNode) img.parentNode.removeChild(img);
                imgContainer.appendChild(makePlaceholder(a.title));
            };
            imgContainer.appendChild(img);
        } else {
            imgContainer.appendChild(makePlaceholder(a.title));
        }

        itemEl.appendChild(imgContainer);

        // Metadata bar overlaid at the bottom — gradient fades up over the artwork
        var metaBar = document.createElement('div');
        metaBar.className = 'feed-item-metadata';
        metaBar.style.cssText = 'position:absolute;bottom:0;left:0;right:0;z-index:2;padding:3rem 2rem 2rem;background:none;display:flex;flex-direction:column;gap:0.35rem;pointer-events:none;';

        var title = document.createElement('h3');
        title.className = 'feed-item-title';
        title.style.cssText = 'margin:0;font-size:1.6rem;font-weight:400;font-style:italic;font-family:var(--font-heading,serif);line-height:1.2;color:#e8e3dc;text-shadow:0 2px 16px rgba(0,0,0,0.9);letter-spacing:-0.02em;';
        title.textContent = a.title || 'Untitled';
        metaBar.appendChild(title);

        var meta = document.createElement('p');
        meta.className = 'feed-item-meta';
        meta.style.cssText = 'margin:0 0 0.9rem;font-size:0.72rem;color:rgba(232,227,220,0.5);font-family:var(--font-ui,sans-serif);letter-spacing:0.13em;text-transform:uppercase;text-shadow:0 1px 8px rgba(0,0,0,0.8);';
        var metaParts = [];
        if (a.artist) metaParts.push(a.artist);
        if (a.year) metaParts.push(a.year);
        if (a.movement) metaParts.push(a.movement);
        meta.textContent = metaParts.join('   ·   ') || 'Unknown';
        metaBar.appendChild(meta);

        var actionsDiv = document.createElement('div');
        actionsDiv.className = 'feed-item-actions';
        actionsDiv.style.cssText = 'display:flex;gap:0.5rem;pointer-events:auto;';

        // PASS button
        var passBtn = document.createElement('button');
        passBtn.className = 'feed-btn feed-btn-pass';
        passBtn.style.cssText = 'flex:1;min-width:80px;padding:0.6rem 1.2rem;font-size:0.78rem;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;border:1px solid rgba(255,255,255,0.3);background:transparent;color:rgba(232,227,220,0.85);cursor:pointer;border-radius:3px;transition:all 0.2s ease;font-family:var(--font-ui,sans-serif);';
        passBtn.textContent = '✕  Pass';
        passBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            self.recordSignal(artworkId, -1, imgContainer, itemEl);
        });
        passBtn.addEventListener('mouseenter', function() {
            passBtn.style.borderColor = '#d33c27';
            passBtn.style.color = '#d33c27';
            passBtn.style.boxShadow = '0 0 12px rgba(211,60,39,0.3)';
        });
        passBtn.addEventListener('mouseleave', function() {
            passBtn.style.borderColor = 'rgba(255,255,255,0.3)';
            passBtn.style.color = 'rgba(232,227,220,0.85)';
            passBtn.style.boxShadow = '';
        });
        actionsDiv.appendChild(passBtn);

        // LIKE button
        var likeBtn = document.createElement('button');
        likeBtn.className = 'feed-btn feed-btn-like';
        likeBtn.style.cssText = 'flex:1;min-width:80px;padding:0.6rem 1.2rem;font-size:0.78rem;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;border:1px solid rgba(255,255,255,0.3);background:transparent;color:rgba(232,227,220,0.85);cursor:pointer;border-radius:3px;transition:all 0.2s ease;font-family:var(--font-ui,sans-serif);';
        likeBtn.textContent = '♥  Like';
        likeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            self.recordSignal(artworkId, 3, imgContainer, itemEl);
        });
        likeBtn.addEventListener('mouseenter', function() {
            likeBtn.style.borderColor = '#d33c27';
            likeBtn.style.color = '#d33c27';
            likeBtn.style.boxShadow = '0 0 12px rgba(211,60,39,0.3)';
        });
        likeBtn.addEventListener('mouseleave', function() {
            likeBtn.style.borderColor = 'rgba(255,255,255,0.3)';
            likeBtn.style.color = 'rgba(232,227,220,0.85)';
            likeBtn.style.boxShadow = '';
        });
        actionsDiv.appendChild(likeBtn);

        // LEARN MORE button
        var learnBtn = document.createElement('button');
        learnBtn.className = 'feed-btn feed-btn-learn';
        learnBtn.style.cssText = 'flex:1;min-width:80px;padding:0.6rem 1.2rem;font-size:0.78rem;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;border:1px solid rgba(255,255,255,0.3);background:transparent;color:rgba(232,227,220,0.85);cursor:pointer;border-radius:3px;transition:all 0.2s ease;font-family:var(--font-ui,sans-serif);';
        learnBtn.textContent = '◎  Explore';
        learnBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            window.viewArtworkDetails && window.viewArtworkDetails(null, artworkId);
        });
        learnBtn.addEventListener('mouseenter', function() {
            learnBtn.style.borderColor = '#d33c27';
            learnBtn.style.color = '#d33c27';
            learnBtn.style.boxShadow = '0 0 12px rgba(211,60,39,0.3)';
        });
        learnBtn.addEventListener('mouseleave', function() {
            learnBtn.style.borderColor = 'rgba(255,255,255,0.3)';
            learnBtn.style.color = 'rgba(232,227,220,0.85)';
            learnBtn.style.boxShadow = '';
        });
        actionsDiv.appendChild(learnBtn);

        // FULLSCREEN button
        var fullscreenBtn = document.createElement('button');
        fullscreenBtn.className = 'feed-btn feed-btn-fullscreen';
        fullscreenBtn.style.cssText = 'flex:1;min-width:80px;padding:0.6rem 1.2rem;font-size:0.78rem;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;border:1px solid rgba(255,255,255,0.3);background:transparent;color:rgba(232,227,220,0.85);cursor:pointer;border-radius:3px;transition:all 0.2s ease;font-family:var(--font-ui,sans-serif);';
        fullscreenBtn.textContent = '⛶  Full';
        fullscreenBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            self.openFullscreen(a);
        });
        fullscreenBtn.addEventListener('mouseenter', function() {
            fullscreenBtn.style.borderColor = '#d33c27';
            fullscreenBtn.style.color = '#d33c27';
            fullscreenBtn.style.boxShadow = '0 0 12px rgba(211,60,39,0.3)';
        });
        fullscreenBtn.addEventListener('mouseleave', function() {
            fullscreenBtn.style.borderColor = 'rgba(255,255,255,0.3)';
            fullscreenBtn.style.color = 'rgba(232,227,220,0.85)';
            fullscreenBtn.style.boxShadow = '';
        });
        fullscreenBtn.style.display = 'flex';
        actionsDiv.appendChild(fullscreenBtn);

        metaBar.appendChild(actionsDiv);
        itemEl.appendChild(metaBar);

        this.attachSwipeGesture(imgContainer, artworkId, imgContainer, itemEl);

        return itemEl;
    },

    attachSwipeGesture(imageEl, artworkId, imgContainer, itemEl) {
        var THRESHOLD = 80;
        var startX = 0;
        var startY = 0;
        var isDragging = false;
        var self = this;

        function onStart(x, y) {
            startX = x;
            startY = y;
            isDragging = true;
            imageEl.style.cursor = 'grabbing';
        }

        function onMove(x, y) {
            if (!isDragging) return;
            var dx = x - startX;
            var dy = y - startY;
            var rotate = dx * 0.05;
            imageEl.style.transform = 'translateX(' + dx + 'px) translateY(' + dy + 'px) rotate(' + rotate + 'deg)';
        }

        function onEnd(x, y) {
            if (!isDragging) return;
            isDragging = false;
            imageEl.style.cursor = 'grab';

            var dx = x - startX;
            var dy = y - startY;

            if (Math.abs(dx) > THRESHOLD && Math.abs(dy) < 100) {
                var weight = dx > 0 ? 3 : -1;
                imageEl.style.transition = 'transform 0.4s ease,opacity 0.4s ease';
                imageEl.style.transform = 'translateX(' + (dx > 0 ? 500 : -500) + 'px) rotate(' + (dx > 0 ? 20 : -20) + 'deg)';
                imageEl.style.opacity = '0.3';

                setTimeout(function() {
                    self.recordSignal(artworkId, weight, imgContainer, itemEl);
                }, 400);
            } else {
                imageEl.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                imageEl.style.transform = '';
            }
        }

        imageEl.addEventListener('touchstart', function(e) {
            if (e.target.tagName === 'BUTTON') return;
            onStart(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });

        imageEl.addEventListener('touchmove', function(e) {
            if (isDragging) onMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });

        imageEl.addEventListener('touchend', function(e) {
            if (isDragging) onEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        });

        imageEl.style.cursor = 'grab';
        imageEl.addEventListener('mousedown', function(e) {
            if (e.target.tagName === 'BUTTON') return;
            e.preventDefault();
            onStart(e.clientX, e.clientY);
        });

        imageEl._boundMove = function(e) {
            if (isDragging) onMove(e.clientX, e.clientY);
        };
        imageEl._boundUp = function(e) {
            if (isDragging) onEnd(e.clientX, e.clientY);
        };

        document.addEventListener('mousemove', imageEl._boundMove);
        document.addEventListener('mouseup', imageEl._boundUp);

        var observer = new MutationObserver(function() {
            if (!document.contains(imageEl)) {
                document.removeEventListener('mousemove', imageEl._boundMove);
                document.removeEventListener('mouseup', imageEl._boundUp);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    },

    async recordSignal(artworkId, weight, imgContainer, itemEl) {
        if (this.pendingSignals[artworkId]) {
            return; // Already processing this signal
        }

        this.pendingSignals[artworkId] = true;

        try {
            var currentWeight = this.signalState[artworkId];
            var newWeight = currentWeight === weight ? null : weight;

            var payload = { artwork_id: artworkId, weight: newWeight === null ? 0 : newWeight };
            await window.API.post('/taste-profile/signal', payload);

            this.signalState[artworkId] = newWeight;

            if (newWeight === null) {
                itemEl.classList.remove('swiped');
                imgContainer.style.opacity = '';
                imgContainer.style.filter = '';
            } else {
                itemEl.classList.add('swiped');
            }

            imgContainer.style.transform = '';
            imgContainer.style.transition = '';

            if (newWeight === 3) {
                await window.API.post('/list/add', { artwork_id: artworkId, list_type: 'seen', rating: 3 }).catch(function(){});
            } else if (newWeight === 5) {
                await window.API.post('/list/add', { artwork_id: artworkId, list_type: 'bucket' }).catch(function(){});
            }

            window.updateNavStats && window.updateNavStats();
        } catch (e) {
            console.error('Failed to record signal:', e);
            imgContainer.style.opacity = '1';
            imgContainer.style.filter = '';
            imgContainer.style.transform = '';
        } finally {
            this.pendingSignals[artworkId] = false;
        }
    },

    setupIntersectionObserver(feedList) {
        var self = this;
        var options = {
            root: null,
            rootMargin: '600px',
            threshold: 0.1
        };

        var callback = function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    self.loadMore();
                }
            });
        };

        if (window.feedObserver) {
            window.feedObserver.disconnect();
        }
        window.feedObserver = new IntersectionObserver(callback, options);

        var lastItem = feedList.lastElementChild;
        if (lastItem) {
            window.feedObserver.observe(lastItem);
        }
    },

    openFullscreen(artwork) {
        var self = this;
        var modal = document.createElement('div');
        modal.className = 'feed-fullscreen-modal';
        modal.id = 'feed-fullscreen-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease;';

        var imgContainer = document.createElement('div');
        imgContainer.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative;';

        if (artwork.image_url_hd || artwork.image_url) {
            var img = document.createElement('img');
            img.src = artwork.image_url_hd || artwork.image_url;
            img.alt = artwork.title || 'Artwork';
            img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;';
            imgContainer.appendChild(img);
        }

        modal.appendChild(imgContainer);

        var closeBtn = document.createElement('button');
        closeBtn.className = 'feed-fullscreen-close';
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'position:absolute;top:1.5rem;right:1.5rem;width:2.5rem;height:2.5rem;border:1px solid rgba(232,227,220,0.3);background:transparent;color:rgba(232,227,220,0.7);font-size:1rem;font-family:var(--font-ui,sans-serif);letter-spacing:0.05em;cursor:pointer;border-radius:2px;transition:all 0.2s;display:flex;align-items:center;justify-content:center;z-index:10000;';
        closeBtn.addEventListener('mouseenter', function() {
            closeBtn.style.borderColor = 'rgba(232,227,220,0.9)';
            closeBtn.style.color = '#e8e3dc';
        });
        closeBtn.addEventListener('mouseleave', function() {
            closeBtn.style.borderColor = 'rgba(232,227,220,0.3)';
            closeBtn.style.color = 'rgba(232,227,220,0.7)';
        });
        closeBtn.addEventListener('click', function() { self.closeFullscreen(modal); });
        imgContainer.appendChild(closeBtn);

        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                self.closeFullscreen(modal);
            }
        });

        var handleEsc = function(e) {
            if (e.key === 'Escape') {
                self.closeFullscreen(modal);
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);

        if (!document.getElementById('feed-fullscreen-styles')) {
            var style = document.createElement('style');
            style.id = 'feed-fullscreen-styles';
            style.textContent = '@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }';
            document.head.appendChild(style);
        }

        document.body.appendChild(modal);
    },

    closeFullscreen(modal) {
        modal.style.animation = 'fadeIn 0.2s ease reverse';
        setTimeout(function() {
            if (document.contains(modal)) {
                document.body.removeChild(modal);
            }
        }, 200);
    }
};
