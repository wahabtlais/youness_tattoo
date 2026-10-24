// The seed imports the website's own data files (src/data/*), which import
// images and audio the way Vite does. At run time db/seed/asset-hooks.mjs
// turns those imports into marker strings; these declarations type them.
declare module '*.webp' {
  const src: string;
  export default src;
}
declare module '*.wav' {
  const src: string;
  export default src;
}
declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
