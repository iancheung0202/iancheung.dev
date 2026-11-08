// Shared behaviour for pages built by zola: theme and nerd mode toggles.
// Both flags live in localStorage under the same keys the home page uses.
(function () {
  var root = document.documentElement;

  function flag(name, value) {
    root.setAttribute('data-' + name, value);
    try { localStorage.setItem(name, value); } catch (e) {}
  }

  var theme = document.getElementById('theme-toggle');
  if (theme) {
    theme.addEventListener('click', function () {
      flag('theme', root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  var nerd = document.getElementById('nerd-toggle');
  if (nerd) {
    var sync = function () { nerd.setAttribute('aria-pressed', root.getAttribute('data-nerd') === 'on'); };
    sync();
    nerd.addEventListener('click', function () {
      flag('nerd', root.getAttribute('data-nerd') === 'on' ? 'off' : 'on');
      sync();
    });
  }
})();

// explorer: open and close folders in the tree
document.querySelectorAll('.tree-folder-label').forEach(function (label) {
  label.addEventListener('click', function () {
    var folder = label.closest('.tree-folder');
    var open = !folder.classList.contains('is-open');
    folder.classList.toggle('is-open', open);
    label.setAttribute('aria-expanded', open);
  });
});
