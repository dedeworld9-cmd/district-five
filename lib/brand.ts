// Department artwork supplied by the departments, by department key.
export const LOGOS: Record<string, string> = {
  hcso: '/logos/hcso.webp',
  sahp: '/logos/sahp.png', safd: '/logos/safd.png', saems: '/logos/saems.png', dps: '/logos/dps.png',
};
// In-game photos shown behind department cards and dashboard banners.
export const PHOTOS: Record<string, string> = {
  sahp: '/logos/sahp-photo.jpg', safd: '/logos/safd-photo.jpg', saems: '/logos/saems-photo.jpg', dps: '/logos/dps-photo.jpg',
};
// Hub color theme per department: two backdrop glows and a tinted base.
export const THEMES: Record<string, { a: string; b: string; bg: string }> = {
  // HCSO green and badge gold.
  hcso: { a: '#2f8f5b', b: '#c9a227', bg: '#050b08' },
  sahp: { a: '#2f6bff', b: '#8fb4ff', bg: '#05080f' },
  safd: { a: '#e5484d', b: '#f59e0b', bg: '#0d0606' },
  saems: { a: '#14b8a6', b: '#e5484d', bg: '#050c0c' },
  dps: { a: '#d6457f', b: '#f2a7c3', bg: '#0d060a' },
};
export const DEFAULT_THEME = { a: '#e5484d', b: '#3e7bfa', bg: '#07090e' };
