const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  output: "export",
  distDir: isProd ? "build" : ".next",
  trailingSlash: true,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  env: { REACT_APP_BACKEND_URL: process.env.REACT_APP_BACKEND_URL },
  allowedDevOrigins: ["*.preview.emergentagent.com", "*.emergentagent.com"],
};

export default nextConfig;
