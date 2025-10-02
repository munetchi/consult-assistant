import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// リポジトリ名をここに設定します。
const repoName = 'consult-assistant'; 

export default defineConfig({
  plugins: [react()],
  // 💡 GitHub Pagesへのデプロイでは、この base オプションが重要です。
  base: `/${repoName}/`, 
});
