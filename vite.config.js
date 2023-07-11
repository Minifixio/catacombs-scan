import { defineConfig } from 'vite'

export default defineConfig({
    root: './',
    build: {
        outDir: 'dist',
        rollupOptions: {
            external: ["fs/promises"],
        },
    },
    assetsInclude: ['**/*.glb']
})