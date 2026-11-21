export const designTokens = {
  colors: {
    ink: '#102a43',
    inkBody: '#172126',
    green: '#166a4a',
    greenDark: '#11553b',
    cream: '#f1eee6',
    paper: '#fbfaf7',
    canvas: '#f7f5f0',
    mist: '#e7f2ec',
    line: '#dde2df',
    lineSoft: '#d5deda',
    muted: '#68777d',
    navMuted: '#526067',
    topbarText: '#dce7ed',
    alert: '#db5a4f',
    blue: '#1d69d5',
  },
  fonts: {
    heading: "'Manrope', sans-serif",
    body: "'DM Sans', sans-serif",
  },
  radius: { sm: '7px', md: '14px', lg: '24px', pill: '999px' },
  shadow: '0 20px 50px rgba(16, 42, 67, 0.10)',
} as const;

export type DesignTokens = typeof designTokens;
