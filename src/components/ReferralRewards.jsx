import React, { useState, useEffect } from 'react';
import { getReferralCode, linkReferralCode } from '../api/referrals';
import { fetchReferralStatsNormalized } from '../api/referralStatsService';
import './ReferralRewards.css';
import { FiCopy, FiCheck, FiChevronDown, FiChevronUp } from 'react-icons/fi';

const ReferralRewards = ({ walletAddress, onShowToast }) => {
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState(null);
  const [stats, setStats] = useState(null);
  const [inputCode, setInputCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    console.log('🔍 ReferralRewards useEffect triggered:', { walletAddress, hasWallet: !!walletAddress });
    if (walletAddress) {
      console.log('✅ Wallet address exists, calling fetchData()');
      fetchData();
      
      // Check for pending referral code from URL
      const pendingCode = localStorage.getItem('pendingReferralCode');
      if (pendingCode && !stats?.hasReferral) {
        setInputCode(pendingCode);
        // Clear from localStorage after reading
        localStorage.removeItem('pendingReferralCode');
      }
    } else {
      console.log('❌ No wallet address, skipping fetchData()');
    }
  }, [walletAddress]);

  const fetchData = async () => {
    console.log('🚀 fetchData() called with walletAddress:', walletAddress);
    setLoading(true);
    try {
      console.log('📡 About to call getReferralCode and getReferralStats');
      const [codeData, statsData] = await Promise.all([
        getReferralCode(walletAddress),
        fetchReferralStatsNormalized(walletAddress)
      ]);

      console.log('📥 Received data:', { codeData, statsData });
      if (codeData) {
        console.log('✅ Setting referral code:', codeData.referralCode, 'from codeData:', codeData);
        setReferralCode(codeData.referralCode);
      } else {
        console.log('⚠️ No codeData received');
      }
      if (statsData) {
        console.log('✅ Setting stats:', statsData);
        console.log('🔍 Stats breakdown:', {
          hasStats: !!statsData,
          activeBoosts: statsData.normalizedBoosts,
          activeBoostsLength: statsData.normalizedBoosts?.length,
          activeBoostsType: typeof statsData.normalizedBoosts,
          isArray: Array.isArray(statsData.normalizedBoosts),
          hasReferral: statsData.hasReferral,
          invited: statsData.invited,
          qualified: statsData.qualified,
          referrerBoosts: statsData.referrerBoosts,
          fullStats: statsData
        });

        setStats({
          ...statsData,
          activeBoosts: Array.isArray(statsData.normalizedBoosts) ? statsData.normalizedBoosts : []
        });
      } else {
        console.log('⚠️ No statsData received');
      }
    } catch (error) {
      console.error('❌ Failed to fetch referral data:', error);
    } finally {
      console.log('🏁 fetchData() completed, setting loading to false');
      setLoading(false);
    }
  };

  const generateInviteLink = () => {
    if (!referralCode) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}?ref=${referralCode}`;
  };

  const handleCopyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onShowToast?.('success', 'Referral code copied to clipboard!');
  };

  const handleCopyLink = () => {
    const link = generateInviteLink();
    if (!link) return;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    onShowToast?.('success', 'Invite link copied to clipboard!');
  };

  const handleSubmitCode = async () => {
    if (!inputCode.trim()) return;
    
    setSubmitting(true);
    try {
      await linkReferralCode(walletAddress, inputCode);
      onShowToast?.('success', 'Referral code linked successfully! You are now qualified for boosts.');
      setInputCode('');
      // Refresh stats to show new status
      fetchData();
    } catch (error) {
      onShowToast?.('error', error.message || 'Failed to link referral code');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (!walletAddress) {
    console.log('❌ ReferralRewards: No walletAddress, returning null');
    return null;
  }
  
  console.log('🎨 ReferralRewards rendering with:', { walletAddress, loading, referralCode, stats });

  return (
    <div className={`referral-rewards-container ${isExpanded ? 'expanded' : ''}`}>
      <div className="referral-header-toggle" onClick={() => setIsExpanded(!isExpanded)}>
        <h3 className="rewards-title">Reward Hub</h3>
        <button 
          className="toggle-button" 
          aria-label={isExpanded ? 'Hide' : 'Show'}
          type="button"
        >
          {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
        </button>
      </div>

      {isExpanded && (
        <>
          {loading ? (
            <div className="loading-spinner-small"></div>
          ) : (
            <>
              {/* Section 1: Your Referral Code */}
              <div className="rewards-card">
                <div className="section-label">Your Referral Code</div>
                <div className="code-display">
                  <span className="code-text">{referralCode || 'Generating...'}</span>
                  <button className="copy-btn" onClick={handleCopyCode} disabled={!referralCode}>
                    {copied ? <FiCheck /> : <FiCopy />} {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                
                {/* Invite Link Section */}
                <div className="section-label" style={{ marginTop: '16px', marginBottom: '16px' }}>
                  Your Invite Link
                </div>
                <div className="code-display">
                  <span className="code-text">{generateInviteLink() || 'Generating...'}</span>
                  <button className="copy-btn" onClick={handleCopyLink} disabled={!referralCode}>
                    {linkCopied ? <FiCheck /> : <FiCopy />} {linkCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                
                <p className="description-text">
                  Share this code or link to earn +0.5% APY boost for 30 days when friends deposit $100+.
                </p>
              </div>

              {/* Section 2: Enter Code (if not linked) or Rewards (if linked) */}
              <div className="rewards-card">
                {!stats?.hasReferral ? (
                  <>
                    <div className="section-label">Have a referral code?</div>
                    <div className="referral-input-group">
                      <input
                        type="text"
                        className="referral-input"
                        placeholder="Enter code"
                        value={inputCode}
                        onChange={(e) => setInputCode(e.target.value)}
                      />
                      <button 
                        className="submit-btn"
                        onClick={handleSubmitCode}
                        disabled={submitting || !inputCode.trim()}
                      >
                        {submitting ? '...' : 'Apply'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="section-label">Total Rewards</div>
                    <div className="rewards-summary">
                      <span className="rewards-label">Accrued Earnings</span>
                      <span className="rewards-value">
                        ${stats?.rewards?.totalAccrued ? parseFloat(stats.rewards.totalAccrued).toFixed(2) : '0.00'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ReferralRewards;
