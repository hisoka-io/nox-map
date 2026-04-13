import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Sort longest-prefix-first so "/node-10" isn't matched by "/node-1"
const nodeProxies = Object.fromEntries(
  Array.from({ length: 15 }, (_, i) => i)
    .sort((a, b) => b - a)
    .map((i) => [
      `/node-${i}`,
      {
        target: `http://localhost:${9090 + i}`,
        rewrite: (path: string) => path.replace(`/node-${i}`, ""),
        changeOrigin: true,
      },
    ]),
);

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3001,
    host: '0.0.0.0',
    proxy: {
      "/cluster": {
        target: "http://localhost:9000",
        changeOrigin: true,
      },
      ...nodeProxies,
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'zustand'],
          'three': ['three', '@react-three/fiber', '@react-three/drei'],
        },
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },

  base: process.env.VITE_BASE_PATH || '/',
});
