# RPC URL & Secrets Cleanup Checklist

Use this checklist in every frontend project to move RPC endpoints and other sensitive values out of the source code.

1. **Inventory projects**
   - List each frontend app in this repo.
   - Note their tooling (Vite, CRA, Next, etc.) to know how they expose env vars.
2. **Search for hard-coded values**
   - Run targeted searches such as `rg -n "http.*rpc" src`, `rg -n "privateKey" src`, and review config/build scripts.
   - Record every location that contains an RPC URL, key, or token.
3. **Define environment variables**
   - Choose consistent names that match the framework requirements (e.g., `VITE_RPC_URL`, `NEXT_PUBLIC_RPC_URL`).
   - Add any additional secrets you discover (e.g., `VITE_INFURA_KEY`).
4. **Update source files**
   - Replace literals with env lookups (`import.meta.env.VITE_RPC_URL`, `process.env.NEXT_PUBLIC_RPC_URL`, etc.).
   - Remove any fallback literals—allow configuration to control values.
5. **Create `.env` artifacts**
   - Add/update `.env` (untracked) with actual endpoints.
   - Add/update `.env.example` with placeholders so others know what to set.
   - Document at least `VITE_RPC_URL=<https://your-endpoint>` in each project.
6. **Adjust docs & build tooling**
   - Update README/setup docs (including `dist/README_ASSETS.md` if relevant) to mention the new variables.
   - Ensure CI/deployment pipelines inject the env vars.
7. **Validate locally**
   - Export the new variables (e.g., `cp .env.example .env` then fill values).
   - Run `npm run dev` / `npm run build` / tests; confirm RPC interactions use the env-sourced URL.
8. **Prepare PR notes**
   - Summarize the changes, list the required env variables, and remind reviewers to create their `.env` with `VITE_RPC_URL`.

Track each project’s status in this document or your PR description to ensure no app is missed.