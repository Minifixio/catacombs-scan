import { defineConfig } from 'vite'

export default defineConfig({
    root: './',
    build: {
        outDir: 'dist',
        rollupOptions: {
            external: ["fs/promises"],
        },
    },
    assetsInclude: ['**/*.glb'],
    server: {
        host: true,
        port: 8000, // Le port ensuite utilisé dans Docker
    }
})