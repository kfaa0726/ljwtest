(() => {
  const menu = document.querySelector('.document-nav');
  if (!menu) return;
  const links = [...menu.querySelectorAll('a')];
  const sections = [...document.querySelectorAll('.document-section')];
  const preferred = sections.find(section => ['overview', 'theme'].includes(section.id));

  function show(scroll) {
    const selected = sections.find(section => '#' + section.id === location.hash);
    const active = selected || preferred;
    if (!active) return;
    for (const section of sections) section.hidden = section !== active;
    for (const link of links) {
      if (link.hash === '#' + active.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    if (scroll && selected) active.scrollIntoView({block: 'start', behavior: 'instant'});
  }

  show(Boolean(location.hash));
  window.addEventListener('hashchange', () => show(true));
})();
