/** @type {import('next').NextConfig} */

// SPIKE: this app is mounted as static output under a subpath of the docs site.
// Keep the literal in one place so it is easy to re-point later.
const BASE_PATH = '/showcase/SPIKE/next';

const nextConfig = {
  // The workspace wrapper + custom-element packages ship ESM with 'use client';
  // let Next process them so directives + custom-element imports resolve cleanly.
  transpilePackages: ['@awc-ui/react', '@awc-ui/core'],

  // Fully static HTML/JS/CSS export — no Node server at runtime.
  output: 'export',

  // Every route and every emitted asset URL is prefixed with the mount path.
  basePath: BASE_PATH,
  assetPrefix: BASE_PATH,

  // Emit `<route>/index.html` (directories) rather than `<route>.html`, so a
  // plain static file server resolves /showcase/SPIKE/next/roles/ correctly.
  trailingSlash: true,

  // next/image's optimizer is a server feature; `output: 'export'` needs it off.
  images: { unoptimized: true },
};
export default nextConfig;
