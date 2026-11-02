# Cove Vault 🥥
A local-first PWA for Coconut Cove Creations: purchased asset library (Booth/Gumroad/Jinxxy/Payhip), wishlist, mood boards, avatar project planner.
- Dev: `npm install && npm run dev`  · Build: `npm run build` → `dist/` · Preview: `npm run preview`
- Theme: edit `src/theme.css` only.
- Data: IndexedDB on the device. Back up via More → Export JSON.
- Gmail receipts: see `tools/parse-receipts.mjs` (header explains the steps), output `import/receipts.json`, load via More → Import JSON.
- Hosting: upload `dist/` (or ../avatar-vault-dist.zip) to GitHub Pages, Netlify or Cloudflare Pages. Uses relative paths, so it works from any subfolder. Needs HTTPS to install.
