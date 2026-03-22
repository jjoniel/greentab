(function() {
  var t = localStorage.getItem('gt-theme');
  document.documentElement.className = t || 'dark';
  var sidebar = localStorage.getItem('gt-sidebar-collapsed');
  if (sidebar === '1' || sidebar === null) document.documentElement.dataset.sidebarCollapsed = '1';
  if (sidebar === null) localStorage.setItem('gt-sidebar-collapsed', '1');
})();
