# cmh-chat-bot

Shared AI chat library for four hosts: the Shopware admin, the AiOAi desktop app, the flow canvas and the mobile app.

## Packages

| Package | Folder | What |
|---|---|---|
| `@cmh/chat-core` | `packages/core` | API client, auth sources, host bridge, transport, store, types, i18n. No UI. |
| `@cmh/chat-primitives` | `packages/primitives` | shadcn-vue and AI Elements Vue copies, `ChatIcon`, theme tokens. |
| `@cmh/chat-parts` | `packages/parts` | The 13 message parts, `EditableApproval`, `PartRenderer`. |
| `@cmh/chat-ui` | `packages/ui` | `ChatMainView`, `ChatDockPanel`, `ChatCanvasDrawer`. |

Dependency direction: `core <- primitives <- parts <- ui`.

Apps: `apps/playground` (demo data, no server) and `apps/standalone-bundle` (iframe bundle).

## Source distribution

The packages ship TypeScript and `.vue` source (`main: ./src/index.ts`). There is no build step and no npm release. The consumer's Vite compiles them.

Install all four from git in one `package.json` (the packages reference each other as peer dependencies):

```json
{
  "dependencies": {
    "@cmh/chat-core": "github:KrommerGmbH/cmh-chat-bot#path:packages/core",
    "@cmh/chat-primitives": "github:KrommerGmbH/cmh-chat-bot#path:packages/primitives",
    "@cmh/chat-parts": "github:KrommerGmbH/cmh-chat-bot#path:packages/parts",
    "@cmh/chat-ui": "github:KrommerGmbH/cmh-chat-bot#path:packages/ui"
  }
}
```

Rules for package manifests in this repo:

- Runtime `dependencies` use literal version ranges. `catalog:` and `workspace:` do not resolve for a git consumer.
- Packages reference each other in `peerDependencies` (`*`) plus `devDependencies` (`workspace:*`).

The consumer needs `vue`, `@vitejs/plugin-vue`, `@tailwindcss/vite`, `tailwindcss`, `tw-animate-css` and `typescript` (the Vue compiler loads TypeScript to resolve the imported prop types; without it the build stops with "Failed to load TypeScript").

Tailwind CSS 4 does not scan `node_modules`. Add the package folders to the consumer CSS:

```css
@source "../node_modules/@cmh/chat-ui/src";
@source "../node_modules/@cmh/chat-parts/src";
@source "../node_modules/@cmh/chat-primitives/src";
```

## Host checklist

A host that imports `ChatMainView` (or `ChatDockPanel` / `ChatCanvasDrawer`) directly must:

- Show toasts: pass `show-toaster`, or mount its own vue-sonner `<Toaster>`. The default of `showToaster` is the value of `ownsDocument`, so a host that does not own the document gets no toast host.
- Call `connectAuth(...)` from `@cmh/chat-core` before the first request.
- Own the theme and the root font size when `ownsDocument` is false. The view then writes nothing to `<html>` / `<body>`. With `ownsDocument` true it sets `data-theme`, `data-palette` (default `aurora`), the dark class and the root font size (13px base, then the user's S/M/L/XL scale).
- Add the Tailwind `@source` lines shown above.
- Remember that `client`, `host` and `transport` are read once at setup (remount to swap them). `flowId` is reactive.

## Commands

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm dev            # playground
pnpm build:bundle   # standalone iframe bundle
```

## License

MIT. Third-party notices: `THIRD-PARTY.md`.
