/**
 * GoodArts — Expandable Section Component
 */
window.Components = window.Components || {};

window.Components.Expandable = function(title, content, defaultOpen) {
    if (!content) return '';
    var id = 'exp-' + Math.random().toString(36).substr(2, 9);
    var openClass = defaultOpen ? ' open' : '';
    return '<div class="expandable' + openClass + '" id="' + id + '">' +
        '<div class="expandable-header" onclick="document.getElementById(\'' + id + '\').classList.toggle(\'open\')">' +
            '<span>' + title + '</span>' +
            '<span class="expandable-chevron">&#9662;</span>' +
        '</div>' +
        '<div class="expandable-body">' +
            '<p>' + content + '</p>' +
        '</div>' +
    '</div>';
};
