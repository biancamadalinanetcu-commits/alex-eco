// Crop map: which part of each supplied key visual is used where on the site.
// Coordinates are in source pixels. Baked-in headline text is cropped away so the
// live, translatable HTML text is the only copy on the page.
export const crops = [
  { name: 'hero-dashboard', src: 'brand/1.webp', left: 700, top: 96, width: 972, height: 750, widths: [560, 900, 1200] },
  { name: 'svc-meta', src: 'brand/1.webp', left: 935, top: 112, width: 702, height: 492, widths: [520, 760, 1040] },
  { name: 'svc-managed', src: 'brand/2.webp', left: 598, top: 540, width: 470, height: 360, widths: [520, 760, 940] },
  { name: 'svc-growth', src: 'brand/2.webp', left: 1096, top: 560, width: 548, height: 276, widths: [520, 760, 1040] },
  { name: 'process-emblem', src: 'brand/2.webp', left: 590, top: 318, width: 352, height: 232, widths: [420, 700] },
  { name: 'results-dashboard', src: 'brand/3.webp', left: 40, top: 480, width: 1214, height: 554, widths: [640, 1000, 1400] },
  { name: 'cta-orb', src: 'brand/4.webp', left: 0, top: 332, width: 1672, height: 609, widths: [800, 1280, 1672] },
];
