/* Shared inline SVG icon set for MyTube (public site + admin dashboard). */
(function () {
  const P = {
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    explore: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 5.3-5.3 2.2 2.2-5.3z"/>',
    subscriptions: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="m10.5 9.5 4.5 2.5-4.5 2.5z"/>',
    library: '<rect x="3" y="5" width="5" height="14" rx="1"/><rect x="10" y="5" width="5" height="14" rx="1"/><path d="m18 6 3-1 3 13-3 1z"/>',
    history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M17 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14c2.5.7 4 2.7 4 6"/>',
    userlist: '<circle cx="8" cy="8" r="3"/><path d="M2 19c0-3.3 2.7-5 6-5s6 1.7 6 5"/><path d="M15 5h7M15 10h7M15 15h5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 1 1 4.1 2.1c-.9.7-1.6 1.3-1.6 2.7"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>',
    flag: '<path d="M5 3v18"/><path d="M5 4h11l-2 4 2 4H5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    play: '<path d="M8 4.5 19 12 8 19.5z" fill="currentColor" stroke="none"/>',
    thumbsup: '<path d="M7 10v10H4a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1z"/><path d="M7 10.5 10.8 3c1.8 0 2.4 1.3 1.9 2.8L11.8 10H18a2 2 0 0 1 2 2.3l-1.3 6A2 2 0 0 1 16.7 20H7"/>',
    thumbsdown: '<g transform="rotate(180 12 12)"><path d="M7 10v10H4a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1z"/><path d="M7 10.5 10.8 3c1.8 0 2.4 1.3 1.9 2.8L11.8 10H18a2 2 0 0 1 2 2.3l-1.3 6A2 2 0 0 1 16.7 20H7"/></g>',
    share: '<path d="M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M14 4h6v6"/><path d="M20 4 11 13"/>',
    save: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    upload: '<path d="M12 16V5"/><path d="m7 10 5-5 5 5"/><path d="M4 19h16"/>',
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    videos: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    analytics: '<path d="M4 20V11M10 20V4M16 20v-6M22 20H2"/>',
    reports: '<path d="M5 3v18"/><path d="M5 4h11l-2 4 2 4H5"/><circle cx="18" cy="16" r=".9" fill="currentColor" stroke="none"/>',
    comments: '<path d="M21 12a8 8 0 0 1-8 8H6l-3 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/>',
    tags: '<path d="M3 11 11 3l9 9-8 8z"/><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/>',
    categories: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    access: '<path d="M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    logout: '<path d="M15 12H3"/><path d="m10 7-5 5 5 5"/><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    chevronleft: '<path d="M15 5l-7 7 7 7"/>',
    chevronright: '<path d="M9 5l7 7-7 7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    star: '<path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M20 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 4-4 3 3 5-5 4 4"/>',
    film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v14M16 5v14"/>',
    folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    arrowup: '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
    arrowdown: '<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>',
    more: '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>',
  };

  function mtIcon(name, size) {
    const inner = P[name];
    if (!inner) return '';
    const s = size || 20;
    return (
      '<svg class="mt-icon" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>'
    );
  }

  window.MTIcons = P;
  window.mtIcon = mtIcon;
})();
