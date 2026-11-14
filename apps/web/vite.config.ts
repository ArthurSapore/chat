import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { resolve } from "node:path"
import { defineConfig, loadEnv } from "vite"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  loadEnv(mode, process.cwd(), "")

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": resolve(import.meta.dirname, "./src"),
      },
    },
  }
})
