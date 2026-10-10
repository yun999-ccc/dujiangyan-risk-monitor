import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{rollupOptions:{output:{manualChunks:{three:['three','three/addons/controls/OrbitControls.js','three/addons/utils/BufferGeometryUtils.js']}}}}});
