import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode:true,
  async headers(){
    return [{source:"/(.*)",headers:[
      {key:"X-Content-Type-Options",value:"nosniff"},
      {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
      {key:"Permissions-Policy",value:"camera=(self), microphone=(self), geolocation=(self)"},
      {key:"Cross-Origin-Opener-Policy",value:"same-origin-allow-popups"},
      {key:"Content-Security-Policy",value:"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://mafundimtaani.onrender.com; frame-src https://www.google.com https://maps.google.com; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"},
    ]}];
  },
};

export default nextConfig;
