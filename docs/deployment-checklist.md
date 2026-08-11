# Deployment checklist

## Release files

Deploy the repository root as a static site. The release includes 11 public pages, the updated sitemap, shared assets and local vendor libraries. The batch generator loads Excel, ZIP and PDF libraries only when those actions are used. Do not deploy `tmp/`, local downloads or QA browser profiles.

## Cloudflare redirect rules

Production currently returns HTTP 200 for all four HTTP/HTTPS and www/non-www variants. Configure server-side rules outside the static repository:

1. Redirect all HTTP requests to HTTPS while preserving host, path and query.
2. Redirect `batchbarcode.com/*` to `https://www.batchbarcode.com/${path}` while preserving query.
3. Confirm every non-canonical variant reaches the final HTTPS/www/trailing-slash URL in one hop.

Cloudflare Pages `_redirects` cannot perform hostname-level redirects. Use Redirect Rules, Bulk Redirects or a Worker.
The static pages intentionally do not use a JavaScript redirect as a substitute for these server-side rules.

## Post-deploy verification

1. Run `curl -I` against all four origin variants and key non-trailing-slash tool URLs.
2. Confirm `/sitemap.xml` contains 11 HTTPS/www canonical URLs with `lastmod` 2026-08-11.
3. Submit the HTTPS sitemap in Search Console and remove the old HTTP sitemap only after the new one is read successfully.
4. Run URL Inspection on all 11 canonical URLs and record Google canonical, crawl time and status.
5. Run Rich Results Test or Schema.org Validator against the deployed home page.
6. Confirm GA receives generation, import, layout, export, print and larger-batch interest events without raw barcode values, file names, column names, free text or email addresses.
