// Shared behaviour for pages built by zola.

// explorer: open and close folders in the tree
document.querySelectorAll('.tree-folder-label').forEach(function (label) {
  label.addEventListener('click', function () {
    var folder = label.closest('.tree-folder');
    var open = !folder.classList.contains('is-open');
    folder.classList.toggle('is-open', open);
    label.setAttribute('aria-expanded', open);
  });
});
