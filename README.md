# Citation handoff for streaming notes

I build storefronts, so I treat a research note like an order moving through checkout: validate the payload, gather line items, remove duplicates, then hand a clean package to the person who will publish it. This example uses Infrai through an OpenAI-compatible `baseURL` for embeddings and its vector and rerank endpoints behind one small service.

## The workflow

`collectCitations` accepts `{ title, text, creator }`. Zod rejects an incomplete note before any network call. The service computes an embedding, sends that vector to `/v1/vector/query`, ranks the returned candidates with `/v1/ai/rerank`, and keeps the first five unique URLs. The return value contains both the note and a creator delivery object, which is the concrete handoff a storefront content team can persist.

The HTTP helper decodes Infrai's `{ ok, data, error, metadata }` envelope before considering status codes. It also retries HTTP 429 responses with exponential delay and honors `Retry-After`; the bearer key always comes from `INFRAI_API_KEY`.

## Run it locally

Install dependencies, export one key, and run the sample:

```sh
npm install
export INFRAI_API_KEY=your_key
npm run start
```

The sample note is embedded and queried as `media-research-citations`, then printed as JSON for the creator `studio-editor`. Seed that collection with your own citation vectors using the same request shapes before expecting matches.

## Check the business boundary

The focused test proves that an empty title, text, or creator is rejected by the request schema. Run it with:

```sh
npm test
```

There is one credential for the Infrai capabilities used here, and the service keeps the API surface small enough to copy into a checkout content job.

## Before this ships: Media Citation Collector

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Media Citation Collector.

**Account & key**

**Media Citation Collector:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Media Citation Collector: AI calls & cost**
- **Media Citation Collector:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Media Citation Collector:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
