/**
 * GoodArts — Swipe Deck Component
 *
 * Attaches drag-to-swipe behaviour to a card element.
 * Supports touch (mobile) and mouse (desktop).
 *
 * Usage:
 *   window.SwipeDeck.attach(cardElement, function(direction) {
 *       // direction: 'left' | 'right' | 'up'
 *   });
 */
window.SwipeDeck = (function() {
    var THRESHOLD = 80; // px drag before triggering swipe

    function attach(cardEl, onSwipe) {
        var startX = 0, startY = 0, isDragging = false;
        var hintEl = document.getElementById('swipe-hint');

        function getHint() { return document.getElementById('swipe-hint'); }

        function onStart(x, y) {
            startX = x; startY = y; isDragging = true;
            cardEl.style.transition = 'none';
            cardEl.style.cursor = 'grabbing';
        }

        function onMove(x, y) {
            if (!isDragging) return;
            var dx = x - startX;
            var dy = y - startY;
            var rotate = dx * 0.07;
            cardEl.style.transform = 'translateX(' + dx + 'px) translateY(' + dy + 'px) rotate(' + rotate + 'deg)';

            var h = getHint();
            if (h) {
                if (dy < -50 && Math.abs(dx) < 60) {
                    h.textContent = '\u2191 LOVE'; h.style.color = 'var(--accent)';
                } else if (dx > 50) {
                    h.textContent = '\u2665 LIKE'; h.style.color = '#2ecc71';
                } else if (dx < -50) {
                    h.textContent = '\u2715 PASS'; h.style.color = '#e74c3c';
                } else {
                    h.textContent = '';
                }
            }
        }

        function onEnd(x, y) {
            if (!isDragging) return;
            isDragging = false;
            cardEl.style.cursor = 'grab';
            var dx = x - startX;
            var dy = y - startY;
            var h = getHint();
            if (h) h.textContent = '';

            if (dy < -THRESHOLD && Math.abs(dx) < 100) {
                flyOut(0, -window.innerHeight, 0, function() { onSwipe('up'); });
            } else if (dx > THRESHOLD) {
                flyOut(window.innerWidth + 100, 0, 20, function() { onSwipe('right'); });
            } else if (dx < -THRESHOLD) {
                flyOut(-window.innerWidth - 100, 0, -20, function() { onSwipe('left'); });
            } else {
                // Snap back
                cardEl.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                cardEl.style.transform = '';
            }
        }

        function flyOut(tx, ty, rotate, cb) {
            cardEl.style.transition = 'transform 0.38s ease, opacity 0.38s ease';
            cardEl.style.transform = 'translateX(' + tx + 'px) translateY(' + ty + 'px) rotate(' + rotate + 'deg)';
            cardEl.style.opacity = '0';
            setTimeout(cb, 400);
        }

        // Touch events
        cardEl.addEventListener('touchstart', function(e) {
            onStart(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });

        cardEl.addEventListener('touchmove', function(e) {
            onMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });

        cardEl.addEventListener('touchend', function(e) {
            onEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        });

        // Mouse events
        cardEl.style.cursor = 'grab';
        cardEl.addEventListener('mousedown', function(e) {
            e.preventDefault();
            onStart(e.clientX, e.clientY);
        });

        var boundMove = function(e) { if (isDragging) onMove(e.clientX, e.clientY); };
        var boundUp = function(e) { if (isDragging) onEnd(e.clientX, e.clientY); };

        document.addEventListener('mousemove', boundMove);
        document.addEventListener('mouseup', boundUp);

        // Cleanup when card is removed
        var observer = new MutationObserver(function() {
            if (!document.contains(cardEl)) {
                document.removeEventListener('mousemove', boundMove);
                document.removeEventListener('mouseup', boundUp);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    return { attach: attach };
})();
