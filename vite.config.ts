import { defineConfig } from 'vite';

export default defineConfig({
  // 將基底路徑設定為相對路徑，這樣部署到 GitHub Pages 子目錄時，資源載入才不會出錯
  base: './',
});

