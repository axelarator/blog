# Axelarator's Blog

Static Astro site for [blog.axelarator.net](https://blog.axelarator.net), migrated from Ghost.

## Requirements

Node 22+ (installed via Homebrew: `brew install node@22 && brew link --force node@22`).

## Commands

| Command           | Action                                 |
| ----------------- | -------------------------------------- |
| `npm run dev`     | Dev server at `localhost:4321`         |
| `npm run build`   | Build the production site to `./dist/` |
| `npm run preview` | Preview the built site locally         |

## Writing posts

Add a markdown file to `src/content/blog/<slug>.md` — the filename becomes the URL (`/<slug>/`). Frontmatter:

```yaml
---
title: "Post title"
description: "Shown on the index page and in RSS/meta tags"
pubDate: 2026-08-03T12:00:00.000-06:00
heroImage: "/images/2026/08/photo.jpg"   # optional
heroImageCaption: "Caption"              # optional
tags: []
---
```

Images go in `public/images/` and are referenced as `/images/...`.

Static pages (like About) live in `src/content/pages/` and also render at `/<slug>/`.

## Deploying to Cloudflare Pages

Build settings:

- **Build command:** `npm run build`

Then add `blog.axelarator.net` as a custom domain on the Pages project — since the domain is already on Cloudflare, it updates the DNS record automatically.

`public/_redirects` keeps Ghost's old `/rss/` feed URL redirecting to `/rss.xml`.

## Migration

`scripts/migrate-from-ghost.mjs` is the one-time script that pulled posts, pages, and all images from the Ghost Content API. It can be re-run to re-sync while Ghost is still up (it overwrites the markdown files in `src/content/`).
