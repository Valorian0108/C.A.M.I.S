import { defineConfig, type ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 5173;

if (rawPort && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || "/";
const apiTarget = process.env.VITE_DEV_API_TARGET || "http://localhost:5000";

function apiModuleFallbackPlugin() {
  return {
    name: "api-module-fallback",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api-module", async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const requestUrl = new URL(req.url || "/", "http://localhost");
          requestUrl.searchParams.delete("_");
          const upstream = await fetch(`${apiTarget}/api${requestUrl.pathname}${requestUrl.search}`);
          const body = await upstream.text();

          res.statusCode = upstream.status;
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");

          if (!upstream.ok) {
            res.end(`export default ${JSON.stringify({
              success: false,
              error: `API error: ${upstream.status} ${upstream.statusText}`,
              body,
            })};`);
            return;
          }

          JSON.parse(body);
          res.end(`export default ${body};`);
        } catch (error) {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
          res.end(`export default ${JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "API module fallback failed",
          })};`);
        }
      });
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    apiModuleFallbackPlugin(),
    mockupPreviewPlugin(),
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
