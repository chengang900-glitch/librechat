# LibreChat HTTP Artifacts Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep the LibreChat portal on HTTP while replacing HTML Artifact preview's public Sandpack static path with a local, sandboxed HTML preview and documenting a local Sandpack bundler deployment.

**Architecture:** HTML Artifacts (`text/html` and `application/vnd.code-html`) render through a new `srcDoc` iframe with `sandbox="allow-scripts"`. Other Artifact types keep the existing Sandpack path. A Compose overlay documents a same-network local Sandpack bundler and exposes its browser-facing URL through `SANDPACK_BUNDLER_URL`.

**Tech Stack:** React, TypeScript, `@codesandbox/sandpack-react`, Docker Compose, Jest/Testing Library.

## Global Constraints

- Keep the portal entry HTTP; do not change Caddy, NAT, OIDC, or public ports.
- Do not use the public CodeSandbox service for the HTML preview path.
- Limit the new iframe to `sandbox="allow-scripts"`; do not add same-origin, forms, popups, or top-navigation permissions.
- Preserve existing React, SVG, Markdown, Mermaid, Office, code-only, and download behavior.
- Record the change in `LibreChat-portal-rc4/docs/portal/CUSTOMIZATIONS.md`.

### Task 1: Add HTML type detection and the sandboxed preview component

**Files:**
- Modify: `LibreChat-portal-rc4/client/src/utils/artifacts.ts`
- Create: `LibreChat-portal-rc4/client/src/components/Artifacts/HtmlArtifactPreview.tsx`
- Test: `LibreChat-portal-rc4/client/src/utils/__tests__/artifacts.test.ts`

**Interfaces:**
- Produce `isHtmlArtifactType(type: string | null | undefined): boolean`.
- Produce `HtmlArtifactPreview({ html, refreshKey }: { html: string; refreshKey: number })`.

- [ ] Add `isHtmlArtifactType` for exactly `text/html` and `application/vnd.code-html`.
- [ ] Add a memoized iframe component that returns an empty state for blank HTML and otherwise renders `srcDoc={html}`, `sandbox="allow-scripts"`, `title="HTML Artifact Preview"`, and a full-size class.
- [ ] Key the iframe by `refreshKey` so refresh re-executes scripts.
- [ ] Add unit coverage for both supported MIME types and unrelated types.

### Task 2: Route HTML Artifacts around Sandpack and support refresh

**Files:**
- Modify: `LibreChat-portal-rc4/client/src/components/Artifacts/SandboxArtifactTabs.tsx`
- Modify: `LibreChat-portal-rc4/client/src/components/Artifacts/ArtifactTabs.tsx`
- Modify: `LibreChat-portal-rc4/client/src/components/Artifacts/Artifacts.tsx`
- Test: `LibreChat-portal-rc4/client/src/components/Artifacts/SandboxArtifactTabs.test.tsx`

**Interfaces:**
- Add optional `previewRevision?: number` to `ArtifactTabs` and `SandboxArtifactTabs`.
- `Artifacts` increments `previewRevision` from its existing refresh button.

- [ ] Pass `previewRevision` from `Artifacts` through `ArtifactTabs` to `SandboxArtifactTabs`.
- [ ] In `SandboxArtifactTabs`, detect HTML types and render `HtmlArtifactPreview` with `editedCode ?? artifact.content ?? ''`; do not call `ArtifactPreview` for HTML.
- [ ] Keep the existing code tab and editor state unchanged.
- [ ] Keep the existing Sandpack path for all non-HTML types.
- [ ] Add tests proving HTML does not mount `ArtifactPreview`, HTML mounts the iframe with the source content, and a revision changes the iframe key.
- [ ] Run the focused client tests.

### Task 3: Add the local Sandpack bundler Compose overlay

**Files:**
- Create: `LibreChat-portal-rc4/deployment/compose.sandpack.yml.example`
- Modify: `LibreChat-portal-rc4/docs/portal/CUSTOMIZATIONS.md`

- [ ] Add a `sandpack` service using `ghcr.io/librechat-ai/codesandbox-client/bundler:latest`, a healthcheck against port 80, and the LibreChat Docker network.
- [ ] Document the browser-facing reverse-proxy URL and `SANDPACK_BUNDLER_URL`; explicitly state that `http://sandpack:80` is not a browser URL.
- [ ] Document CORS, Worker JavaScript MIME types, and the fact that the local bundler does not fix the HTML iframe compatibility path.
- [ ] Add a dated customization entry to `CUSTOMIZATIONS.md` with the files, HTTP boundary, security sandbox, and rollback behavior.

### Task 4: Validate and review

**Files:**
- Modify only files from Tasks 1–3 if fixes are required.

- [ ] Run `npm test` for the focused artifact tests from `LibreChat-portal-rc4/client`.
- [ ] Run `npx tsc --noEmit` in the client workspace.
- [ ] Run `docker compose -f LibreChat-portal-rc4/deployment/compose.sandpack.yml.example config` with a minimal project override or validate YAML syntax using the repository's available tool.
- [ ] Inspect the final diff for accidental HTTP-to-HTTPS, OIDC, NAT, or unrelated Portal changes.
- [ ] Record any runtime deployment limitation separately; do not claim production preview acceptance without rebuilding/restarting the server image and browser-testing an actual HTML Artifact.
