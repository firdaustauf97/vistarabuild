# Vistara Build CMS

Website menggunakan:

- GitHub Pages dan Jekyll
- Decap CMS
- GitHub OAuth
- Cloudflare Worker

## Placeholder yang harus diganti

Cari dan ganti:

- GITHUB_USERNAME
- YOUR-WORKER.workers.dev

File terkait:

- `_config.yml`
- `admin/config.yml`

## Website

Halaman publik:

`https://GITHUB_USERNAME.github.io/vistara-build/`

Panel admin:

`https://GITHUB_USERNAME.github.io/vistara-build/admin/`

## Cloudflare Worker

Salin isi `worker/oauth-worker.js` ke Cloudflare Worker.

Isi variabel dan secret berikut:

- ADMIN_ORIGIN
- ALLOWED_GITHUB_USER
- GITHUB_SCOPE
- GITHUB_CLIENT_ID
- GITHUB_CLIENT_SECRET
- STATE_SECRET

ADMIN_ORIGIN untuk GitHub Pages:

`https://GITHUB_USERNAME.github.io`

GITHUB_SCOPE:

`public_repo`

Jangan pernah memasukkan GitHub Client Secret ke repository.