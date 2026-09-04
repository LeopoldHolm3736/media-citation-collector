import { strict as assert } from "node:assert";
import { parseNote } from "./citation_delivery";

assert.throws(() => parseNote({ title: "", text: "", creator: "" }));
console.log("request boundary rejects an incomplete storefront research note");
