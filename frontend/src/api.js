/**
 * api.js — Centralized API client for CommunityFlow
 *
 * All fetch calls go through these helpers so the base URL is
 * defined in one place and the Vite dev-proxy handles CORS.
 */

const BASE = '/api';

async function handleResponse(res) {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch (_) {
      // ignore parse errors
    }
    throw new Error(detail);
  }
  return res.json();
}

/**
 * POST /api/ingest/text
 * @param {string} rawText
 * @param {string|null} hintLanguage  e.g. "en", "kn", "hi"
 * @returns {Promise<PipelineResponse>}
 */
export async function ingestText(rawText, hintLanguage = null) {
  const res = await fetch(`${BASE}/ingest/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_text: rawText, hint_language: hintLanguage }),
  });
  return handleResponse(res);
}

/**
 * POST /api/ingest/file
 * @param {File} file
 * @param {string|null} hintLanguage
 * @returns {Promise<PipelineResponse>}
 */
export async function ingestFile(file, hintLanguage = null) {
  const form = new FormData();
  form.append('file', file);
  if (hintLanguage) form.append('hint_language', hintLanguage);

  const res = await fetch(`${BASE}/ingest/file`, {
    method: 'POST',
    body: form,
  });
  return handleResponse(res);
}

/**
 * POST /api/match
 * @param {{ description: string, required_skills: string[], location: string, volunteers_needed: number, urgency: string }} payload
 * @returns {Promise<MatchResponse>}
 */
export async function matchVolunteers(payload) {
  const res = await fetch(`${BASE}/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

/**
 * PATCH /api/volunteers/:id/status
 * @param {string} volunteerId
 * @param {'available'|'busy'|'inactive'} status
 */
export async function updateVolunteerStatus(volunteerId, status) {
  const res = await fetch(`${BASE}/volunteers/${volunteerId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ volunteer_id: volunteerId, status }),
  });
  return handleResponse(res);
}

/**
 * GET /api/health
 */
export async function getHealth() {
  const res = await fetch(`${BASE}/health`);
  return handleResponse(res);
}
