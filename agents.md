# Working on this repo

n8n community node for ReplyNodes. Programmatic style, n8n strict mode, zero runtime dependencies.

## Layout

- `nodes/ReplyNodes/operations.ts`: the operation table. One entry per operation: host, path, auth
  mode, response kind, and typed fields. Adding an operation usually means adding one entry here.
- `nodes/ReplyNodes/request.ts`: builds the HTTP request for any table entry, and sets the
  `x-replynodes-source` headers.
- `nodes/ReplyNodes/properties.ts`: generates the n8n UI parameters from the table.
- `nodes/ReplyNodes/execute.ts`: per-item loop, credential choice, output shaping, error mapping.
- `credentials/ReplyNodesApi.credentials.ts`: optional API key credential.

## Commands

```sh
npm ci                  # install
npm run dev             # start n8n at http://localhost:5678 with this node loaded, rebuilding on change
npm run lint            # n8n strict lint (must pass for verification)
npm run lint:fix
npm test                # unit tests, then the contract test
npm run test:unit       # offline
npm run test:contract   # fetches https://api.replynodes.com/v1/capabilities and checks the table against it
npm run build
npm run smoke           # calls the three free endpoints once each; manual only, not in CI
npm run check           # everything CI runs before publishing
```

End-to-end tests run inside a real n8n instance on a GitHub runner: Actions > "E2E in n8n" > Run
workflow (`.github/workflows/e2e.yml`). It runs `tests/e2e/*.workflow.json` and the recipes, checked by
`scripts/e2e-check.mjs`. Keyed operations run only if the `REPLYNODES_API_KEY` repository secret is set.

The e2e job marks its own traffic with `X-ReplyNodes-Analytics: exclude`, which the ReplyNodes API treats
as an opt-out from usage analytics (exactly one value, case-insensitive). The job adds the header to its
built copy of the node in the "Load the built node" step; the published node never sends it, so real n8n
usage stays counted through `x-replynodes-source: n8n`. Run with `skip_search` (default on) to leave out
the Search operation while it is unavailable.
Don't run n8n on the production server.

## Rules

- Node code must not read environment variables or files, and must not add runtime dependencies.
  Tests and scripts use the `.cts` extension so the n8n runtime lint rules (which cover `**/*.ts`) skip them; they run in Node only and are not published.
- Only call ReplyNodes hosts. No telemetry or third-party calls.
- Never commit API keys. Pass a test key through `REPLYNODES_API_KEY` in your shell only.
- Releases: `npm run release` bumps, tags, and creates a GitHub release; the publish workflow then
  publishes to npm with provenance. Do not run `npm publish` locally (it is blocked on purpose).
