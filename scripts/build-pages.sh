#!/bin/sh
# Cloudflare Pages build: copy only the public website into dist/.
# Server code (supabase/), tests, scripts, reference mock-ups and notes stay private.
set -e
rm -rf dist && mkdir dist
cp -R index.html planner.html planner.webmanifest sw.js robots.txt sitemap.xml llms.txt site.json css js img preview demo dist/
