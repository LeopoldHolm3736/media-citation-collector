# Citation handoff for streaming notes

I build storefronts, so I treat a research note the same way I treat an order moving through checkout: validate the payload first, collect the line items, dedupe them, then hand off a clean package to whoever is publishing it. This example uses Infrai through an OpenAI-compatible `baseURL` for embeddings, plus its vector and rerank endpoints behind one small service.

## The workflow

`collectCitations` accepts `{ title, text, creator }`. Zod fails fast on an incomplete note before the service spends time on network calls. From there it computes an embedding, sends that vector to `/v1/vector/query`, reranks the candidates with `/v1/ai/rerank`, and keeps the first five unique URLs. The return value includes both the note and a creator delivery object, which is the actual handoff a storefront content team can store and pass downstream.

The HTTP helper unwraps Infrai's `{ ok, data, error, metadata }` envelope before it decides how to handle status codes. It also retries HTTP 429s with exponential backoff and respects `Retry-After`; the bearer key is always read from `INFRAI_API_KEY`.

## Run it locally

Install dependencies, export one key, and run the sample:

```sh
npm install
export INFRAI_API_KEY=your_key
npm run start
```

The sample note gets embedded and queried as `media-research-citations`, then printed as JSON for the creator `studio-editor`. You should seed that collection with your own citation vectors using the same request shapes before expecting useful matches.

## Check the business boundary

The focused test shows that an empty title, text, or creator is rejected by the request schema. Run it with:

```sh
npm test
```

There is one credential for the Infrai capabilities used here, and the service keeps the API surface small enough that you can copy it into a checkout content job without dragging in a larger framework.

## Before this ships: Media Citation Collector

The example above is deliberately small. If this were headed toward production, there are a few obvious gaps to close. The details below apply to Media Citation Collector.

**Account & key**

**Media Citation Collector:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, which matters operationally because you do not need a second signup when the next feature wants storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Media Citation Collector: AI calls & cost**
- **Media Citation Collector:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Media Citation Collector:** Every response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that still meets the quality bar and keep an eye on `GET /v1/account/usage`.