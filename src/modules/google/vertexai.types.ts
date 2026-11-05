// Origin: https://github.com/enricoros/big-AGI/issues/1114
// Gemini/Vertex AI grounding redirect links, shared by the client and the server resolver.

export const VERTEX_GROUNDING_REDIRECT_PREFIX = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/';

// the full redirect URL: prefix + base64url-ish token (e.g. 'AUZIYQH...xx7==')
export const VERTEX_GROUNDING_REDIRECT_REGEX = /https:\/\/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\/[A-Za-z0-9_=-]+/g;

/** The server's answer for one link. */
export type VertexLinkResolution =
  | { url: string, outcome: 'resolved', resolved: string }
  | VertexLinkUnresolved;

/** 'dead': expired (404). 'unknown': no answer in time, a network error or an unexpected status - worth asking again. */
export type VertexLinkUnresolved = { url: string, outcome: 'dead' | 'unknown', reason: string };

/*
 * What the resolver relies on, measured 2026-11-05:
 * - a complete link answers 302 in about 0.2s from the moment it streams: no warm-up
 * - 404 is final: expired (302 at 8 days, 404 by 58) or malformed; no throttling seen, failures are connection-level
 * - links stream in grounding chunks (final event), URL Context tool calls (mid-stream), and the text when the model lists
 *   its sources (Argon, Deep Research)
 */
