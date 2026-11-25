# Parcel: product catalog capstone

A modular single-page app with no framework. It shows ES-module architecture, History API routing, code splitting, a production build and a static deploy.

## Run it locally

```bash
npm install          # installs esbuild
npm run dev          # dev server on http://localhost:3000 (serves src/ with SPA fallback)
npm run build        # minified, hashed, code-split output in ./dist
npm run preview      # serve ./dist on http://localhost:4000 to test the real build
```

Opening `index.html` by double-click will not work: browsers block ES modules and `fetch` on `file://`. Use `npm run dev`.

## Structure

```
src/
  index.html            app shell (header, <main id="app">, live region)
  css/main.css          tokens, layout, light/dark theme
  data/products.json    catalog data (fetched at runtime)
  images/*.svg          product images
  js/
    main.js             wires router, cart badge, active nav link
    router.js           History API router: params, link interception, focus, titles
    store.js            cart state + localStorage + subscribe
    api.js              data layer (cached fetch with retry)
    components/         productCard (+ delegated add-to-cart)
    views/              home, catalog, product, cart, notfound (lazy-loaded)
    utils/              dom helper, formatting, screen-reader announcements
scripts/build.mjs       esbuild build + hashing + HTML rewrite + size report
netlify.toml, vercel.json   SPA rewrites and cache headers
```

## Routes

| Path | View |
| --- | --- |
| `/` | Home with featured products and categories |
| `/products?q=&category=&sort=` | Catalog; filters live in the URL |
| `/product/:id` | Product detail |
| `/cart` | Cart |
| anything else | 404 view |

## Performance work

- JS and CSS are bundled and minified, file names carry a content hash, and each view is a separate chunk loaded on first visit.
- Hashed assets are cached for a year (`immutable`), so repeat visits download almost nothing.
- System font stack: no web-font download.
- Images have `width` and `height` (no layout shift), `loading="lazy"` below the fold, and `fetchpriority="high"` on the product detail hero image.
- For real photos: export WebP or AVIF at 600 px and 1200 px, and add `srcset` and `sizes` to `<img>`.

## Deploy

Push this folder to a GitHub repository first (`dist` and `node_modules` are git-ignored).

**Netlify** (uses `netlify.toml`):
1. Netlify dashboard, Add new site, Import an existing project, choose the repo.
2. Build command `npm run build`, publish directory `dist` (already in `netlify.toml`). Click Deploy.
3. Quick alternative: run `npm run build`, then drag the `dist` folder onto app.netlify.com/drop.

**Vercel** (uses `vercel.json`):
1. Vercel dashboard, Add New, Project, import the repo, then Deploy. Or run `npx vercel --prod` in this folder.

**Render**:
1. New, Static Site, connect the repo.
2. Build command `npm install && npm run build`, publish directory `dist`.
3. Under Redirects/Rewrites add: source `/*`, destination `/index.html`, action Rewrite.

After deploying, open `/products?category=bags` and `/product/watch` directly and refresh. If they load instead of showing a host 404, the SPA fallback is working. Then run Lighthouse in Chrome DevTools.
