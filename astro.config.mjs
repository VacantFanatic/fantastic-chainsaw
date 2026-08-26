// @ts-check
import { defineConfig } from "astro/config";
import netlify from "@astrojs/netlify";

// Static by default: every page that can be a file stays a file, exactly
// as this site always worked. Only the field notes routes opt into
// server rendering (`export const prerender = false`), because those are
// the ones that must reflect the database without a rebuild. Everything
// under public/ is copied to dist/ untouched.
// The Netlify adapter bundles a local dev server that shells out to
// @netlify/dev, which fails to start on Windows and swallows its own
// error. `astro dev` doesn't need the adapter -- Astro renders on-demand
// routes itself -- so it's only attached for builds, where it's what
// produces the SSR function. `npm run build` still exercises the real one.
const isDev = process.argv.includes("dev");

export default defineConfig({
  site: process.env.SITE_URL ?? "https://fantastic-chainsaw.netlify.app",
  output: isDev ? "server" : "static",
  adapter: isDev ? undefined : netlify(),
  trailingSlash: "ignore",
  devToolbar: { enabled: false },
});
