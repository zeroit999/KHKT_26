import { useMediaQuery } from 'react-responsive'

const BREAKPOINTS = {
  mobileMax: 767,
  tabletMin: 768,
  tabletMax: 1023,
  laptopMin: 1024,
  laptopMax: 1439,
  desktopMin: 1440,
  wideDesktopMin: 1920,
}

export default function useResponsive() {
  const isMobile = useMediaQuery({
    maxWidth: BREAKPOINTS.mobileMax,
  })

  const isTablet = useMediaQuery({
    minWidth: BREAKPOINTS.tabletMin,
    maxWidth: BREAKPOINTS.tabletMax,
  })

  const isLaptop = useMediaQuery({
    minWidth: BREAKPOINTS.laptopMin,
    maxWidth: BREAKPOINTS.laptopMax,
  })

  const isDesktop = useMediaQuery({
    minWidth: BREAKPOINTS.desktopMin,
  })

  const isWideDesktop = useMediaQuery({
    minWidth: BREAKPOINTS.wideDesktopMin,
  })

  const isTouchDevice = useMediaQuery({
    query: '(hover: none) and (pointer: coarse)',
  })

  const canHover = useMediaQuery({
    query: '(hover: hover) and (pointer: fine)',
  })

  const isPortrait = useMediaQuery({
    query: '(orientation: portrait)',
  })

  const isLandscape = useMediaQuery({
    query: '(orientation: landscape)',
  })

  const prefersReducedMotion = useMediaQuery({
    query: '(prefers-reduced-motion: reduce)',
  })

  return {
    isMobile,
    isTablet,
    isLaptop,
    isDesktop,
    isWideDesktop,

    isMobileOrTablet: isMobile || isTablet,
    isTabletOrLarger: !isMobile,
    isLaptopOrLarger: isLaptop || isDesktop,
    isDesktopOrLarger: isDesktop,
    isCompactScreen: isMobile || isTablet,
    isLargeScreen: isDesktop,

    isTouchDevice,
    canHover,
    isPortrait,
    isLandscape,
    prefersReducedMotion,
  }
}