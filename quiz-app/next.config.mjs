/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // The two sources moved under their own routes; keep old bookmarks working.
  async redirects() {
    return [{ source: "/flashcards", destination: "/dsai/flashcards", permanent: true }];
  },
};

export default nextConfig;
