import { ENV } from '../config/env';
import { computeAPY } from '../utils/calculateYield';

const API_BASE = `${ENV.apiBaseUrl}/api`;
const APY_ENDPOINT = `${API_BASE}/apy`;
const APY_HISTORY_ENDPOINT = `${API_BASE}/apy/history`;

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Request failed (${response.status}): ${errorText || response.statusText}`);
  }
  return response.json();
}

export async function fetchCurrentApy(options = {}) {
  const { useFallback = true } = options;
  try {
    const data = await fetchJson(APY_ENDPOINT);
    const apyValue = Number(data?.apy);
    if (!Number.isFinite(apyValue)) {
      throw new Error('Backend did not return a numeric APY');
    }
    return apyValue;
  } catch (error) {
    console.warn('Failed to fetch current APY from backend:', error);
    if (useFallback) {
      try {
        const fallbackApy = await computeAPY();
        console.warn('Using locally computed APY fallback:', fallbackApy);
        return fallbackApy;
      } catch (fallbackError) {
        console.warn('APY fallback computation failed:', fallbackError);
      }
    }
    return 0;
  }
}

export async function fetchApyHistory() {
  try {
    const data = await fetchJson(APY_HISTORY_ENDPOINT);
    if (!Array.isArray(data?.history)) {
      throw new Error('Backend did not return a history array');
    }
    return data.history;
  } catch (error) {
    console.warn('Failed to fetch APY history from backend:', error);
    return [];
  }
}
