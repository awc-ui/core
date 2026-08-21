/** @type {import('next').NextConfig} */
const nextConfig = {
  // The workspace wrapper + custom-element packages ship ESM with 'use client';
  // let Next process them so directives + custom-element imports resolve cleanly.
  transpilePackages: ['@awc-ui/react', '@awc-ui/core'],
};
export default nextConfig;
