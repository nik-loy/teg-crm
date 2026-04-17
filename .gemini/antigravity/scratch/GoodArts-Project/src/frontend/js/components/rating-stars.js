/**
 * Rating Stars Component
 */
window.Components = window.Components || {};

window.Components.RatingStars = (rating) => {
    let stars = '';
    for(let i=1; i<=5; i++) {
        const fill = i <= (rating || 0) ? 'var(--accent)' : 'transparent';
        const stroke = 'var(--text-color)';
        // Abstract star shape 
        stars += `
            <svg viewBox="0 0 100 100" width="20" height="20" style="margin-right:2px">
                <polygon points="50,10 61,40 95,40 68,60 78,90 50,70 22,90 32,60 5,40 39,40" 
                         fill="${fill}" stroke="${stroke}" stroke-width="4" stroke-linejoin="round"/>
            </svg>
        `;
    }
    return `<div style="display:inline-flex;">${stars}</div>`;
};
