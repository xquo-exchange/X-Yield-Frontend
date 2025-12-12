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
    console.log('📊 Fetching APY history from:', APY_HISTORY_ENDPOINT);
    const data = await fetchJson(APY_HISTORY_ENDPOINT);
    console.log('📥 Backend APY history response:', { 
      hasData: !!data, 
      hasHistory: !!data?.history, 
      historyType: Array.isArray(data?.history) ? 'array' : typeof data?.history,
      historyLength: Array.isArray(data?.history) ? data.history.length : 'N/A',
      firstItem: Array.isArray(data?.history) && data.history.length > 0 ? data.history[0] : null
    });
    
    if (!Array.isArray(data?.history)) {
      console.error('❌ Backend did not return a history array. Received:', data);
      throw new Error('Backend did not return a history array');
    }
    
    if (data.history.length === 0) {
      console.warn('⚠️ Backend returned empty history array');
    }
    
    return data.history;
  } catch (error) {
    console.error('❌ Failed to fetch APY history from backend:', {
      error: error.message,
      endpoint: APY_HISTORY_ENDPOINT,
      stack: error.stack
    });
    return [];
  }
}
