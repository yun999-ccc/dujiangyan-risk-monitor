import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',timeout:40000,use:{baseURL:process.env.MONITOR_BASE_URL||'http://127.0.0.1:5173',headless:true,launchOptions:{...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}}});
