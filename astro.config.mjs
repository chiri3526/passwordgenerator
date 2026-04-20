import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  integrations: [react()],
  output: "static",
  vite: {
    envPrefix: ["PUBLIC_", "VITE_"]
  }
});
