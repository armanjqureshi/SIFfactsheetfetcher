# 1 Finance SIF Factsheet Reader

React / Express / tRPC / Drizzle starter, adapted from the Sandbox web-db-user template.

**Run it on your own computer:** see [LOCAL_SETUP.md](LOCAL_SETUP.md). Local mode (`LOCAL_MODE=true`) replaces Manus login and storage with an automatic local user and a local PDF folder.

**Host it with a public link:** see [RAILWAY.md](RAILWAY.md). Setting `APP_PASSWORD` adds a password screen; without it, local mode refuses connections from other computers.

- `pnpm dev`: development server; honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build and serve `dist/index.js` and `dist/public/`.
- `pnpm db:migrate`: apply checked-in migrations. `pnpm db:push`: generate and apply new schema changes.
- `pnpm check` / `pnpm test`: types and application tests.

Start with the Webdev skill's default-template guide. Platform login, storage, payments and service contracts live in its shared references; read the relevant capability before extending its helper.

`server/_core/publicConfig.ts` exposes only named public runtime values. Private keys stay server-side. The platform serves managed `/manus-storage/` assets; the application does not register a second proxy.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints. The agent may modify the files, commands and configuration or follow the flexible guide for another stack.
