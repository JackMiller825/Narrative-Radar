# Image evaluation

Status: not run.

No paid image calls were made in this session. There are no sample outputs, latency numbers, costs, or quality scores to report. A template SVG is not an AI render and is not entered here as a benchmark result.

The production adapter remains the OpenAI image call in `packages/providers/src/openai.ts`. It runs only when `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL`, and `OPENAI_IMAGE_SIZE` are set. `gpt-image-2.5-sunburst` is a candidate named in the October 8 brief. It is not selected here, because this environment did not confirm that model id against current provider documentation.

Gemini and FLUX adapters are not implemented. Adding one requires an official model id, a configured key, and a saved comparison on the same briefs.
