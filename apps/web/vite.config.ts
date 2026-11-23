import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // One env file for the whole repo: <root>/.env.development (see .env.example).
  envDir: '../..',
  plugins: [react(), tailwindcss()],
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
});
