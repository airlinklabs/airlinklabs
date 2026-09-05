// @ts-check
import { defineConfig } from "astro/config";
import tailwind from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";

// https://astro.build/config
export default defineConfig({
  site: "https://airlinklabs.github.io",
  output: "static",
  trailingSlash: "always",
  integrations: [mdx()],
  server: {
    host: "0.0.0.0",
    port: 4321,
    allowedHosts: true,
  },
  vite: {
    plugins: [tailwind()],
  },
});
