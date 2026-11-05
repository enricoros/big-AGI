// Origin: https://github.com/enricoros/big-AGI/issues/1114
// Shared client/server constants for Gemini/Vertex AI grounding redirect links.

export const VERTEX_GROUNDING_REDIRECT_PREFIX = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/';

// matches the full redirect URL: prefix + base64url-ish token (e.g. 'AUZIYQH...xx7==')
export const VERTEX_GROUNDING_REDIRECT_REGEX = /https:\/\/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\/[A-Za-z0-9_=-]+/g;

/**
 * One answer per URL from the server resolver:
 * - resolved: the destination, in `resolved` for clients from before this shape
 * - dead: no redirect anymore, the link expired (lifetime note below)
 * - unknown: no answer before the call's deadline, or a network error - ask again
 */
export type VertexLinkResolution =
  | { url: string, outcome: 'resolved', resolved: string }
  | { url: string, outcome: 'dead' }
  | { url: string, outcome: 'unknown' };

/*
 * MEASURED 2026-11-04, 94 fresh links from gemini-2.5-flash and gemini-4-argon, residential connection: HEAD answers in
 * 0.2s (p50) to 0.37s (p99), always 302; a 272-request burst at 64-way concurrency drew no throttling. Neither the redirect
 * hop nor the destinations send CORS headers, so only a server can read the Location. Hence the budgets: a 3-4s call
 * deadline covers 64 links even through a 6-connection queue (11 waves of 0.2s), and what a queue leaves unanswered costs
 * one more round, never the batch. In the captured streams grounding arrives on the final event only, chunks carry
 * web.title and web.uri only, no URI repeats, and the body text holds no redirect links.
 *
 * MAINTENANCE - redirect link lifetime is UNDOCUMENTED by Google, re-verify periodically.
 * CONFIRMED: links DO expire. Observed window (as of 2026-06-19): alive at ~8d, dead (404) by ~58d.
 *
 * If these links expire, resolution of OLD messages silently degrades: the server answers 'dead'
 * (non-302 response) and the links are kept as-is, so the manual 'Resolve N Vertex AI links'
 * button on aged chats reports expired links. Resolution at generation time (policy 'resolve') is
 * unaffected, as it runs while links are seconds old.
 *
 * To test, HEAD a dated sample below and expect '302' with the matching 'location:' header:
 *   curl -sI 'https://vertexaisearch.cloud.google.com/...' | grep -iE '^(HTTP|location)'
 *
 * Samples created 2026-06-11 (gemini-2.5-flash + google_search grounding), verified same day.
 * Re-verified 2026-06-19 (age ~8d): all three still 302 to the expected locations - links survive >=8 days.
 * Older sample from 2026-04-22 (age ~58d) returned 404 (no location) on 2026-06-19 - expiry confirmed.
 * - expect location: https://www.anthropic.com/news/claude-fable-5-mythos-5
 *   https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHvVhBBwjWESwXcWQH8wm6MNDyJY3FOqt7Q4Jkij_DodoMI0dtx5g-q6BNc6CxgGKmQWrCjLDQ_5-4bIQSzAE2akCOrP-R4EaS91YKk6Bfu153zEuCxXN1Vlcx9IOIBOQmw8l5_wnPvYNFdHNLAs6cw
 * - expect location: https://overchat.ai/ai-hub/the-best-ai-model
 *   https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEzT0gP8RsQ3cubKcoSls7Ulx7EMeivI9lQif4L_lxesigitp1B2z0Gj1qXeOnz-4uz2LZBVeHpiOZDC2YkG3AxsMtvyemyiXZoFbf_XBVViN9zTGdxX0bU21uPaFf097ziki1ZgOo=
 * - expect location: https://felloai.com/best-ai-models/
 *   https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGaUi-68RO0Z6q27stfE1FP4dik7qFfua4kQVVPrK3rREt_jR9saoCWYUlL6xlwsAiQuXmOi2ek1Eje9-AlNxbfw6NMHOK0HWjbeur3A-Q7jMNuvytk0_X93WmGfMI=
 *
 * When to re-test: when touching this module, or on user reports of the Resolve button failing
 * on old conversations. If the samples no longer 302 to the expected locations, the links DO
 * expire: note the observed lifetime here, set expectations in the Settings tooltip and the
 * Resolve button copy, and consider making 'resolve' the default policy so links are captured
 * while fresh.
 */
