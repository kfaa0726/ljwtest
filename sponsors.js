(() => {
  const profiles = [...document.querySelectorAll('.sponsor-profile')];
  const links = document.querySelectorAll('.sponsor-sidebar a');

  function showProfile() {
    const target = profiles.find(profile => '#' + profile.id === location.hash);
    const current = target || profiles[0];
    for (const profile of profiles) profile.hidden = profile !== current;
    for (const link of links) {
      if (link.hash === '#' + current.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    if (target) target.scrollIntoView({block: 'start', behavior: 'instant'});
  }

  showProfile();
  window.addEventListener('hashchange', showProfile);
})();
