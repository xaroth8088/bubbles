import {defineConfig} from 'vite';
export default defineConfig({
  base:'./',
  publicDir:'public',
  server:{host:'127.0.0.1',port:4173,strictPort:true},
  build:{target:'es2022',manifest:true,emptyOutDir:true,chunkSizeWarningLimit:300}
});
