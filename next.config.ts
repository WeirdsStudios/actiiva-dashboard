import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La pregunta mas pesada del pack acepta fotos de hasta 15 MB. Next limita
  // Server Actions a 1 MB por defecto, asi que el limite debe coincidir con
  // la validacion estricta que se ejecuta antes de subir a Storage.
  experimental: {
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
