// Lets the seed import the website's own content files (src/data/*), which
// import images and audio the way Vite does. Here such an import becomes
// a marker string naming the file - the seed never needs the bytes.
import { register } from 'node:module';

register(new URL('./asset-hooks.mjs', import.meta.url));
