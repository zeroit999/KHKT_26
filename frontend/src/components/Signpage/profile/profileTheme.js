export function getProfileTheme(isDark) {
  if (isDark) {
    return {
      pageBg: '#0D0C25',

      panel:
        'linear-gradient(135deg, #251642 0%, #1B1D40 55%, #14253E 100%)',

      panelSolid:
        '#191A37',

      text:
        '#F8FAFC',

      subText:
        '#B7B5C8',

      label:
        '#77738E',

      emptyText:
        'rgba(255,255,255,0.32)',

      border:
        'rgba(255,255,255,0.10)',

      divider:
        'rgba(255,255,255,0.08)',

      inputBg:
        'rgba(15,18,42,0.75)',

      inputBorder:
        'rgba(255,255,255,0.14)',

      buttonSecondary:
        'rgba(255,255,255,0.08)',

      buttonSecondaryText:
        '#E2E8F0',

      lockedBg:
        'rgba(255,255,255,0.025)',

      lockedBorder:
        'rgba(255,255,255,0.06)',

      glow:
        'rgba(124,58,237,0.20)',
    }
  }

  return {
    pageBg:
      '#F4F5FA',

    panel:
      'linear-gradient(135deg, #FFFFFF 0%, #F7F8FF 55%, #F5FAFF 100%)',

    panelSolid:
      '#FFFFFF',

    text:
      '#111827',

    subText:
      '#64748B',

    label:
      '#94A3B8',

    emptyText:
      '#B1B8C5',

    border:
      'rgba(15,23,42,0.10)',

    divider:
      'rgba(15,23,42,0.08)',

    inputBg:
      '#FFFFFF',

    inputBorder:
      '#CBD5E1',

    buttonSecondary:
      '#EEF2F7',

    buttonSecondaryText:
      '#475569',

    lockedBg:
      'rgba(248,250,252,0.72)',

    lockedBorder:
      'rgba(148,163,184,0.14)',

    glow:
      'rgba(99,102,241,0.10)',
  }
}