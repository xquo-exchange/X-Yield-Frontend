import { ENV } from '../config/env';

const BASE_URL = ENV.apiBaseUrl;
console.log('🔧 Referrals API - BASE_URL:', BASE_URL);

/**
 * Helper to handle API responses
 */
async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `API Error: ${response.status}`);
  }
  return response.json();
}

/**
 * Get user's referral code
 * @param {string} userId - Wallet address
 */
export async function getReferralCode(userId) {
  console.log('📞 getReferralCode() called with userId:', userId);
  if (!userId) {
    console.log('❌ getReferralCode: No userId provided, returning null');
    return null;
  }
  const address = userId.toLowerCase();
  const url = `${BASE_URL}/api/referrals/${address}/code`;
  console.log('🌐 getReferralCode: Fetching from URL:', url);
  
  try {
    console.log('⏳ getReferralCode: Starting fetch...');
    const response = await fetch(url);
    console.log('📥 getReferralCode: Response received:', { status: response.status, statusText: response.statusText, ok: response.ok });
    // If 404, user might not have a code yet, which is fine
    if (response.status === 404) {
      console.log('⚠️ getReferralCode: 404 - user might not have a code yet');
      return null;
    }
    const data = await handleResponse(response);
    console.log('✅ getReferralCode: Success, data:', data);
    return data;
  } catch (error) {
    console.error('❌ getReferralCode: Error fetching referral code:', error);
    return null;
  }
}

/**
 * Get user's stats (balance, boosts, rewards)
 * @param {string} userId - Wallet address
 */
export async function getReferralStats(userId) {
  console.log('📞 getReferralStats() called with userId:', userId);
  if (!userId) {
    console.log('❌ getReferralStats: No userId provided, returning null');
    return null;
  }
  const address = userId.toLowerCase();
  const url = `${BASE_URL}/api/referrals/${address}/stats`;
  console.log('🌐 getReferralStats: Fetching from URL:', url);
  
  try {
    console.log('⏳ getReferralStats: Starting fetch...');
    const response = await fetch(url);
    console.log('📥 getReferralStats: Response received:', { status: response.status, statusText: response.statusText, ok: response.ok });
    const data = await handleResponse(response);
    console.log('✅ getReferralStats: Success, data:', data);
    return data;
  } catch (error) {
    console.error('❌ getReferralStats: Error fetching referral stats:', error);
    throw error;
  }
}

/**
 * Link a referral code to the current user
 * @param {string} refereeId - Current user's wallet address
 * @param {string} referralCode - The code to link
 */
export async function linkReferralCode(refereeId, referralCode) {
  if (!refereeId || !referralCode) throw new Error('Missing required fields');
  
  const payload = {
    refereeId: refereeId.toLowerCase(),
    referralCode: referralCode.trim()
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/referrals/link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return handleResponse(response);
  } catch (error) {
    console.error('Error linking referral code:', error);
    throw error;
  }
}

