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

### Layout variables

`@cmh/chat-primitives/theme.css` sets these CSS variables on `html`. A host overrides them on any ancestor of the chat view to change widths and icon sizes. In a narrow view (`data-narrow`, set by the view; or `data-channel="mobile"`) both widths become `calc(100cqw - 2rem)`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `--chat-content-width` | `76cqw` | Width of the conversation area (approval cards and AI answer components) as a share of the chat column (container query unit, so the scrollbar does not shift it). |
| `--chat-content-min` | `20rem` | Floor of that width. A window narrower than this uses 100%. |
| `--chat-prose-max` | `46rem` | Line length limit for body text only (paragraph, list, quote, heading). Tables, code, cards and approval cards ignore it. |
| `--chat-input-width` | `76cqw` | Width of the input box. Keep it equal to `--chat-content-width` so the left and right edges line up. |
| `--chat-input-icon` | `max(1.25rem, 20px)` | Edge of every icon inside the input box. |
| `--chat-input-control` | `max(2.25rem, 36px)` | Height of buttons and select fields inside the input box (touch target). |
| `--chat-gap` | `2.5rem` | Space between two messages. |

## Mobile app (iframe)

The mobile app embeds the bundle as an iframe page and copies the build output of `pnpm build:bundle` from `apps/standalone-bundle/dist-relative` (base `./`, relative asset URLs) into its own web folder. Open it with `?mode=mobile`.

In the app the iframe is served from the app origin, but the API lives on the shop server. The host sends the server URL in `CMH_CHAT_INIT`:

```js
iframe.contentWindow.postMessage(
  { type: 'CMH_CHAT_INIT', token, locale, theme, channel: 'mobile', mode: 'page', apiBaseUrl: 'https://shop.example' },
  window.location.origin,
)
```

- `apiBaseUrl` is used **only** with `?mode=mobile`; for `admin` and `canvas` it is ignored (the shop serves the bundle itself).
- It must be an absolute `http:` / `https:` URL without credentials. Query, hash and a trailing slash are dropped. Anything else is ignored (`parseApiBaseUrl` in `apps/standalone-bundle/src/bootConfig.ts`).
- Order of precedence: build-time `VITE_API_BASE`, then `apiBaseUrl`, then same origin. The base is read on every request. The token is sent only to the origin of the current base.
- The same trust checks apply as for every host message (allowed origin and `event.source === window.parent`).

### CMH_CHAT_SEND

The host sends text (for example a scanned barcode) and the chat sends it as a user message, as if it was typed in the input box (no attachments, current harness and model):

```js
iframe.contentWindow.postMessage({ type: 'CMH_CHAT_SEND', text: '4006381333931' }, window.location.origin)
```

Any channel may use it, including `canvas`. Empty or blank text is ignored. Text longer than 2,000 characters is ignored with a `console.warn`. If no harness is loaded yet, the latest text is kept and sent as soon as a harness is available (it is dropped when the view unmounts). `ChatMainView`, `ChatDockPanel` and `ChatCanvasDrawer` expose the same function as `sendText(text)` for hosts that import the component directly.

## Flow canvas (cross-origin iframe)

The flow canvas page and the chat bundle are usually on different origins. The bundle accepts host messages only from its own origin and from the origins listed at build time:

```sh
VITE_ALLOWED_PARENT_ORIGINS=https://flow.example pnpm --filter @cmh/chat-standalone-bundle build:admin
```

- `VITE_ALLOWED_PARENT_ORIGINS` is the origin of the canvas page (several origins: comma separated, for example `https://flow.example,https://flow-2.example`). `build:admin` does not set it; Vite reads every `VITE_*` variable from the environment of the build process (or from an `.env` file in `apps/standalone-bundle`, none is committed).
- Iframe URL: `https://<bundle host>/.../index.html?mode=canvas&flowId=<flow id>&parent=<origin of the canvas page>`. A `parent` value that is not in the build-time list is ignored.
- If the origin is missing from the list, no `CMH_CHAT_INIT` is accepted (the chat has no token) and the console shows an error after 10 s: `No CMH_CHAT_INIT received from the parent window after 10 s`.

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
