# Custom Brochure Backend

This backend reads the saved profile and event URL from the frontend request, fetches the event page, compares page signals with profile interests, creates digital assets, and writes a tailored static web page.

The event reader extracts structured event information before page generation:

- JSON-LD `Event` data when available.
- Open Graph and Twitter title, description, and image metadata.
- Likely event dates and locations from visible page text.
- Source event images from `og:image`, `twitter:image`, JSON-LD `image`, and page `<img>` tags.
- Source sections from headings and nearby body copy.

Web page customization orchestration lives in `customizeWebPage/`, which keeps the route handler and generation pipeline separate from the HTTP server wiring.

## Run

```bash
cd backEnd
npm start
```

The API listens on `http://localhost:3001`.

## Endpoints

- `GET /health`
- `POST /api/create-web-page`
- `POST /api/create-video`
- `POST /api/happyhorse-video-jobs`
- `GET /api/happyhorse-video-jobs/:jobId`

Example payload:

```json
{
  "profile": {
    "title": "Young Family",
    "summary": "Budget awareness, safety, convenience, flexibility, and activities that work for multiple ages."
  },
  "eventUrl": "https://example.com/event"
}
```

The response includes the generated page URL, local digital asset URLs, parsed event data in `analysis.json`, the profile-event comparison, and a `magnificAssets` manifest. Each generated page includes immediate local SVG assets under `assets/`, uses the best source event image as the hero when one is available, renders a source-image gallery, and maps the same asset IDs to Magnific MCP prompts so those local assets can be replaced by Magnific raster outputs without changing the page structure.

Video customization uses Magnific MCP `video_generate` with Happy Horse (`happy-horse-1`) and builds the prompt from the saved profile plus parsed event data. Real generation goes through the Magnific MCP server only. Configure `MAGNIFIC_MCP_URL` in `.env` if it differs from `https://mcp.magnific.com`; `MAGNIFIC_API_BASE_URL` is also accepted for compatibility. Set `MAGNIFIC_API_KEY` to the API key from your Magnific developer dashboard. `MAGNIFIC_MCP_TOKEN` is also accepted as an alias. Mock video output is opt-in only:

```bash
HAPPY_HORSE_USE_MOCK=true npm start
```

The `Create Video` browser flow uses the newer HappyHorse job endpoints. The frontend opens a waiting tab immediately, creates a local backend job with `POST /api/happyhorse-video-jobs`, polls `GET /api/happyhorse-video-jobs/:jobId`, and navigates to the video player when the job returns a video URL. The backend reads the Model Studio key from `.env` as `DASHSCOPE_API_KEY`; that key is never returned to the browser. The Alibaba Model Studio payload uses `duration: 10`. When `ALIBABA_MODEL_STUDIO_MCP_URL` or `MODEL_STUDIO_MCP_URL` is set, the backend calls that MCP server with JSON-RPC `tools/call`; otherwise it uses the DashScope-compatible Model Studio task API directly. The default direct API URL is `https://dashscope-intl.aliyuncs.com`; set `DASHSCOPE_BASE_URL` if your API key was created for another region, such as Virginia or Beijing. For local tests without provider calls:

```bash
HAPPY_HORSE_ALIBABA_USE_MOCK=true npm start
```
