// @ts-check
import { defineConfig } from "astro/config";
import tailwind from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import { remarkWrapTables } from "./src/lib/remark-wrap-tables.mjs";

// https://astro.build/config
export default defineConfig({
  site: "https://airlinklabs.xyz",
  output: "static",
  trailingSlash: "always",
  integrations: [mdx()],
  markdown: {
    remarkPlugins: [remarkWrapTables],
  },
  server: {
    host: "0.0.0.0",
    port: 4321,
    allowedHosts: true,
  },
  vite: {
    plugins: [tailwind()],
  },
});
