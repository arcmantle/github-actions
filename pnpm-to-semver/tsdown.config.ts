import { defineConfig } from "tsdown"


export default defineConfig({
	outDir: './dist',
	entry: './src/main.ts',
	sourcemap: false,
	minify: false,
})