import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';

/** Emotion cache that rewrites CSS logical properties for RTL (used for Hebrew). */
export const rtlCache = createCache({
  key: 'mui-rtl',
  stylisPlugins: [prefixer, rtlPlugin],
});

/** Default LTR emotion cache. */
export const ltrCache = createCache({ key: 'mui' });
