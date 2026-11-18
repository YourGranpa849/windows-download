import { defineConfig } from 'vite';
export default defineConfig({server:{proxy:{'/api':'http://127.0.0.1:5050','/socket.io':{target:'http://127.0.0.1:5050',ws:true},'/files':'http://127.0.0.1:5050','/sounds':'http://127.0.0.1:5050'}},build:{chunkSizeWarningLimit:900}});
