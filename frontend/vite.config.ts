import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// 환경변수는 프로젝트 루트의 단일 .env 를 사용 (백엔드와 공유)
export default defineConfig({
  envDir: '..',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
      manifest: {
        name: 'GDC Life',
        short_name: 'GDC Life',
        description: 'HD현대마린솔루션 GDC 임직원 전용 사내 플랫폼',
        lang: 'ko',
        start_url: '/home',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#0b7285',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // 지도 SDK/타일과 API 응답은 캐시하지 않는다 (실시간성 우선)
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true, // 모바일 실기기에서 같은 Wi-Fi로 접속하기 위해 LAN 바인딩
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
})
