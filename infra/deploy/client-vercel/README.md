# Client → Vercel

## Setup

1. Connect the GitHub repository to Vercel.
2. Set **Root Directory** to `client`.
3. Set **Framework Preset** to Next.js.
4. Set build command: `npm run build`
5. Set output directory: `.next`

## Environment Variables (Vercel dashboard)

| Variable | Type | Value |
|----------|------|-------|
| `NEXT_PUBLIC_API_BASE_URL` | Build-time | `https://api.astroblink.example.com` |
| `API_INTERNAL_URL` | Runtime | Same as above (Vercel Edge doesn't have container networking) |
| `TILE_BASE_URL` | Runtime | `https://tiles.astroblink.example.com` or S3 CDN URL |

## Notes

- `NEXT_PUBLIC_API_BASE_URL` is inlined at build time. Changing it requires a redeploy.
- Vercel automatically handles the standalone output and serverless functions.
- The `/health` route handler works as a Vercel serverless function.
