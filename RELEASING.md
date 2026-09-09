# Releasing `@jely/chat-widget`

How a change to this package reaches a customer's site. There is no CI — every step here is
manual and run from this folder.

Nothing in this repo is deployed to a server. The package goes to npm; the customer's own
site picks it up when they bump the dependency and redeploy. That is the whole pipeline.

For the **first-time / full-stack** deploy (backend, dashboard, migration, npm org), see
`../DEPLOY-widget-support.md`. This file is only "I changed the widget, now what".

---

## The loop

```bash
# 1. checks
npm run typecheck
npm run format:check          # `npm run format` to fix
npm run build

# 2. see it work — two terminals
npm run smoke:api             # terminal 1: mock API on :8787
npm run smoke                 # terminal 2: builds the page, serves :4173
#   open http://localhost:4173/   and   http://localhost:4173/csp.html
#   (README → "Local development against a mock API" lists what to walk)

# 3. version — edit "version" in package.json, see Semver below

# 4. COMMIT AND PUSH FIRST. Then publish.
git add -A && git commit -m "…" && git push

# 5. publish (prepublishOnly re-runs typecheck + build)
npm publish --access public

# 6. verify the registry has what you think it has
npm view @jely/chat-widget version
```

### Step 6 is not optional — verify the bundle, not just the number

`npm view … version` only proves _a_ publish happened. To prove **your change** is in it:

```bash
cd "$(mktemp -d)"
npm pack @jely/chat-widget@<version>
tar xzf jely-chat-widget-<version>.tgz
grep -c "some string only your change added" package/dist/index.js
```

This is worth the thirty seconds. `0.1.3` was published four minutes _before_ the commit
that finished it, so the registry shipped a `0.1.3` that was missing the last change while
the repo's `0.1.3` had it — and npm versions are immutable, so it could only be fixed by
burning a version number.

---

## The rules that bite

**A published version can never be changed.** Not re-published, not amended. Unpublishing is
only allowed within 72 hours and it _breaks_ every install that already pinned it. To fix a
bad release, publish the next patch and `npm deprecate @jely/chat-widget@<bad> "use <good>"`.

**Publish from a clean tree, after pushing.** `dist/` is gitignored and the tarball is built
from `src/` at publish time — so whatever is in your working directory ships, committed or
not. Publishing before you commit is how the registry and the repo drift apart.

**`files: ["dist"]`.** The tarball is `dist/` plus `README.md`, `LICENSE` and `package.json`.
`src/`, `smoke/` and `examples/` never ship — the README is the only prose a customer reads,
so a behaviour change usually means editing it too.

**Never ship a widget that calls an endpoint production does not have.** The package talks to
`DEFAULT_API_BASE_URL` (`src/api.ts`) — the live API — unless the host passes `apiBaseUrl`.
An npm release therefore reaches production the moment a customer installs it. If a change
needs a new field or route: contract first (`jelyv2-frontend/contract/` is canonical), then
backend deployed, _then_ publish.

**The widget renders nothing when `GET /config` fails.** A bad release is silent on the
customer's site, not loud. That is what the smoke page's `/csp.html` is for.

---

## Semver for this package

The public surface is exactly what `src/index.ts` exports. Everything else — the views, the
stylesheet, `copy.ts`, the reducer, the API client — is internal and can change in a patch.

| Bump  | For                                                                                   |
| ----- | ------------------------------------------------------------------------------------- |
| patch | Bug fixes, copy, CSS, layout, anything inside the shadow root                         |
| minor | A new optional prop, a new export, a new appearance field                             |
| major | Removing or renaming an exported prop or type, or changing a default a host relies on |

While the package is `0.x`, treat a major as "bump the minor and say so loudly in the README".

---

## After publishing

1. **Tell the customer to bump.** `npm install @jely/chat-widget@latest` and redeploy their
   site. Until they do, they keep serving the old bundle — there is no auto-update.
2. **If the change touches CSP** (a new origin the widget fetches from), the dashboard's
   Widget → Appearance and Install cards generate the `next.config.js` customers paste;
   check `jelyv2-frontend/src/pages/developer/catalog/widgetInstallGuide.ts` still prints the
   truth.
3. **If the change is visible**, the dashboard's own preview
   (`jelyv2-frontend/src/pages/developer/widget/WidgetPreview.tsx`) is a separate
   implementation of the same look. It does not update itself.

---

## Prerequisites (once per machine)

```bash
npm whoami                    # must print: jely
git remote -v                 # git@github.com:tech-relai/jely-chat-widget.git
```

`npm login` if `whoami` fails. The package is scoped and public, which is why
`--access public` is on the publish command and in `publishConfig`.
