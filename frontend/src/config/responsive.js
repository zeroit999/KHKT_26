export const BREAKPOINTS = {
  mobileMax: 767,
  tabletMin: 768,
  tabletMax: 1023,
  laptopMin: 1024,
  laptopMax: 1439,
  desktopMin: 1440,
  wideDesktopMin: 1920,
}

export const MEDIA_QUERIES = {
  mobile: {
    maxWidth: BREAKPOINTS.mobileMax,
  },

  tablet: {
    minWidth: BREAKPOINTS.tabletMin,
    maxWidth: BREAKPOINTS.tabletMax,
  },

  laptop: {
    minWidth: BREAKPOINTS.laptopMin,
    maxWidth: BREAKPOINTS.laptopMax,
  },

  desktop: {
    minWidth: BREAKPOINTS.desktopMin,
  },

  wideDesktop: {
    minWidth: BREAKPOINTS.wideDesktopMin,
  },

  touch: {
    query: '(hover: none) and (pointer: coarse)',
  },

  hover: {
    query: '(hover: hover) and (pointer: fine)',
  },

  portrait: {
    query: '(orientation: portrait)',
  },

  landscape: {
    query: '(orientation: landscape)',
  },

  reducedMotion: {
    query: '(prefers-reduced-motion: reduce)',
  },
}