const ASSET = /\.(webp|wav|mp3|m4a|png|jpe?g|gif|svg|avif|mp4|webm|glb|css)$/i;

export async function load(url, context, next) {
  const { pathname } = new URL(url);
  if (ASSET.test(pathname)) {
    const rel = pathname.slice(pathname.lastIndexOf('/src/') + 1);
    return { format: 'module', shortCircuit: true, source: `export default ${JSON.stringify(`asset:${rel}`)};` };
  }
  return next(url, context);
}
