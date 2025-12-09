import React, { useState, useEffect } from 'react';
import { getReferralCode, getReferralStats, linkReferralCode } from '../api/referrals';
import './ReferralRewards.css';
import { FiCopy, FiCheck } from 'react-icons/fi';

const ReferralRewards = ({ walletAddress, onShowToast }) => {
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState(null);
  const [stats, setStats] = useState(null);
  const [inputCode, setInputCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.log('🔍 ReferralRewards useEffect triggered:', { walletAddress, hasWallet: !!walletAddress });
    if (walletAddress) {
      console.log('✅ Wallet address exists, calling fetchData()');
      fetchData();
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
        getReferralStats(walletAddress)
      ]);

      console.log('📥 Received data:', { codeData, statsData });
      if (codeData) {
        console.log('✅ Setting referral code:', codeData.code);
        setReferralCode(codeData.referralCode);
      } else {
        console.log('⚠️ No codeData received');
      }
      if (statsData) {
        console.log('✅ Setting stats:', statsData);
        setStats(statsData);
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

  const handleCopyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onShowToast?.('success', 'Referral code copied to clipboard!');
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
    <div className="referral-rewards-container">
      <h3 className="rewards-title">Reward Hub</h3>

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
            <p className="description-text">
              Share this code to earn +0.5% APY boost for 30 days when friends deposit $100+.
            </p>
          </div>

          {/* Section 2: Active Boosts */}
          <div className="rewards-card">
            <div className="section-label" style={{ marginBottom: '12px' }}>Your Boosts</div>
            
            {stats?.activeBoosts && stats.activeBoosts.length > 0 ? (
              <div className="boosts-grid">
                {stats.activeBoosts.map((boost, index) => (
                  <div key={boost.id || index} className={`boost-item ${boost.status === 'ACTIVE' ? 'active' : ''}`}>
                    <div className="boost-header">
                      <span className="boost-type">
                        {boost.type === 'REFERRAL' ? 'Friend Referral' : 
                         boost.type === 'DEPOSIT' ? 'Deposit Boost' : 'Welcome Boost'}
                      </span>
                      <span className="boost-apy">+{boost.apyBoost}% APY</span>
                    </div>
                    
                    <div className="boost-details">
                      {boost.status === 'ACTIVE' && (
                        <div className="boost-dates">
                          Ends {formatDate(boost.endsAt)}
                        </div>
                      )}
                      <div className={`boost-status-text status-${boost.status.toLowerCase()}`}>
                        <span className="boost-status-dot"></span>
                        {boost.status === 'ACTIVE' ? 'Active' : boost.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                No active boosts properly qualified yet. Deposit $100+ to activate pending boosts.
              </div>
            )}
          </div>

          {/* Section 3: Enter Code (if not linked) or Rewards (if linked) */}
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
    </div>
  );
};

export default ReferralRewards;

