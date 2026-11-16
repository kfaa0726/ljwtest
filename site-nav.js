(() => {
  const toggle = document.getElementById('menuToggle');
  const menu = document.getElementById('mainMenu');
  if (!toggle || !menu) return;

  function setOpen(open) {
    menu.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  }

  toggle.addEventListener('click', () => setOpen(!menu.classList.contains('open')));
  menu.addEventListener('click', event => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('click', event => {
    if (!menu.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.classList.contains('open')) {
      setOpen(false);
      toggle.focus();
    }
  });
})();
