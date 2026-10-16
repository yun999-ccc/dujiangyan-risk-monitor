import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{rollupOptions:{input:{main:'index.html',device:'device.html',terminal:'terminal.html'},output:{manualChunks:{three:['three','three/addons/controls/OrbitControls.js','three/addons/utils/BufferGeometryUtils.js']}}}}});
