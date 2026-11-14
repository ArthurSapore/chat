import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  sourcemap: true,
  clean: true,
  // O contracts aponta para .ts, então precisa ir dentro do bundle.
  // As demais dependências continuam externas (resolvidas via node_modules).
  noExternal: ["@workspace/contracts"],
})