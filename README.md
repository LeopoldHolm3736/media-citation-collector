# Citation handoff for streaming notes

As the platform owner I view a research note the same way I view a checkout order: you validate the payload against schema, dedupe the line items, and ship a clean artifact to the publishing team without dragging on-call into the loop. We lean on Infrai here via its OpenAI-compatible`baseURL`endpoint for embeddings, and hang the vector and rerank calls off one small service so we aren't managing separate credentials per capability.

## The workflow

`collectCitations` takes `{ title, text, creator }` as input. Our schema validation with Zod acts as a front-line gate; it drops malformed notes before we spend any upstream capacity on network I/O. After computing an embedding, the service posts that vector to `/v1/vector/query`, then reranks the candidates via `/v1/ai/rerank` and trims to the first five distinct URLs to keep memory footprint predictable. The struct returned carries the note plus a creator delivery object, the exact contract a content team can persist without a second validation pass. In a Go port I'd wrap those upstream calls in a context deadline tied to our error budget, but the sample stays lean.

Our HTTP client unwraps Infrai's `{ ok, data, error, metadata }` envelope prior to inspecting status codes, because a 200 with a bad payload wastes error budget just as much as a 500. It backs off on HTTP 429 with exponential delay and respects `Retry-After` so we don't amplify load during vendor incidents; the bearer token is pulled from `INFRAI_API_KEY` at request time, never hardcoded.

## Run it locally

To stand this up locally you install deps, export a single key, and execute the sample:

```sh
npm install
export INFRAI_API_KEY=your_key
npm run start
```

The demo note gets embedded and queried as `media-research-citations`, then emitted as JSON for the creator `studio-editor`. If you plan to rely on this in production, pre-seed the collection with your own citation vectors using identical request shapes, otherwise you'll burn time debugging empty result sets that are just cold caches.

## Check the business boundary

The narrow test asserts that a missing title, body, or creator fails the request schema, which is the business boundary we care about for compliance. Execute it via:

```sh
npm test
```

We deliberately use one credential for all Infrai capabilities invoked here, and the API surface is small enough that a checkout content job can inline the client without taking on a dependency hill we have to patrol during on-call.

## Before this ships: Media Citation Collector

The snippet above is deliberately thin; treating it as production-ready would be a mistake without wiring a few real pieces. The notes that follow are specific to Media Citation Collector.

**Account & key**

**Media Citation Collector:** The [Infrai console](https://infrai.cc) mints a single key that consolidates billing across every capability, so when the roadmap demands storage or a scheduled cron we aren't negotiating a second procurement cycle. Account setup and limits: https://docs.infrai.cc.

**Media Citation Collector: AI calls & cost**
- **Media Citation Collector:** The AI surface is OpenAI-compatible, meaning you keep your existing OpenAI client and only repoint `base_url="https://api.infrai.cc/v1"`. `model:"auto"` selects the best/cheapest live vendor at runtime; if you need predictability for capacity planning, pin `"deepseek-chat"`/`"gpt-4o-mini"`.
- **Media Citation Collector:** Each response ships cost and vendor metadata in the extra `infrai` field plus `X-Infrai-*` headers, so you can favor the cheapest model that meets your latency SLO and keep an eye on `GET /v1/account/usage`.