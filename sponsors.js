(() => {
  function showProfile(scroll) {
    const profiles = [...document.querySelectorAll('.sponsor-profile')];
    const links = document.querySelectorAll('.sponsor-sidebar a');
    const target = profiles.find(profile => '#' + profile.id === location.hash);
    const current = target || profiles[0];
    if (!current) return;
    for (const profile of profiles) profile.hidden = profile !== current;
    for (const link of links) {
      if (link.hash === '#' + current.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    if (target && scroll) target.scrollIntoView({block: 'start', behavior: 'instant'});
  }

  showProfile();
  window.addEventListener('hashchange', () => showProfile(true));
  document.addEventListener('kosac:sponsors-updated', () => showProfile(Boolean(location.hash)));
})();
