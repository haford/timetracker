import type { NextConfig } from "next";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com https://*.googleapis.com",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.googleapis.com https://*.firebase.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com",
  "img-src 'self' data: https:",
  "frame-src https://timetracker-hans.firebaseapp.com https://accounts.google.com",
  "font-src 'self' data:",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
