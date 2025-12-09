import { ENV } from '../config/env';

const BASE_URL = ENV.apiBaseUrl;

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
  if (!userId) return null;
  const address = userId.toLowerCase();
  
  try {
    const response = await fetch(`${BASE_URL}/api/referrals/${address}/code`);
    // If 404, user might not have a code yet, which is fine
    if (response.status === 404) return null;
    return handleResponse(response);
  } catch (error) {
    console.error('Error fetching referral code:', error);
    return null;
  }
}

/**
 * Get user's stats (balance, boosts, rewards)
 * @param {string} userId - Wallet address
 */
export async function getReferralStats(userId) {
  if (!userId) return null;
  const address = userId.toLowerCase();
  
  try {
    const response = await fetch(`${BASE_URL}/api/referrals/${address}/stats`);
    return handleResponse(response);
  } catch (error) {
    console.error('Error fetching referral stats:', error);
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

