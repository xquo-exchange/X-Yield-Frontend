import React from 'react';
import ReactDOM from 'react-dom';
import './InfoModal.css';

const INFO_CONTENT = {
  apy: {
    title: 'What is APY?',
    content: [
      'APY (Annual Percentage Yield) is your annualized return rate.',
      '• Calculated in real-time from Morpho Protocol markets',
      '• Your actual returns may vary with market conditions',
      '• The vault automatically optimizes across multiple markets'
    ]
  },
  xpls: {
    title: 'What is xPLS?',
    content: [
      'xPLS is your vault receipt token.',
      '• You receive xPLS when you deposit USDC',
      '• Your xPLS balance grows as the vault earns yield',
      '• Convert xPLS back to USDC when you withdraw'
    ]
  },
  earnings: {
    title: 'Projected Earnings',
    content: [
      'Estimates based on current APY.',
      '• These are projections only',
      '• Actual returns depend on market conditions',
      '• APY can change over time'
    ]
  },
  withdrawal: {
    title: 'Withdrawal Details',
    content: [
      '• Vault Tokens: Amount of xPLS you\'re withdrawing',
      '• USDC (est.): Estimated USDC you\'ll receive',
      '• Net Amount: Final amount after fees (if applicable)',
      '',
      'Note: Actual USDC may vary slightly due to exchange rates.'
    ]
  },
  vault: {
    title: 'How It Works',
    content: [
      '1. Deposit USDC → Get xPLS tokens',
      '2. Vault optimizes across Morpho markets',
      '3. Earn yield automatically',
      '4. Withdraw anytime',
      '',
      'Powered by Morpho Protocol on Base.'
    ]
  }
};

export const InfoButton = ({ type, className = '', onClick }) => {
  return (
    <button
      className={`info-button ${className}`}
      onClick={onClick}
      aria-label="More information"
      type="button"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M8 6V8M8 10H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </button>
  );
};

const InfoModal = ({ type, isOpen, onClose }) => {
  if (!isOpen || !type) return null;

  const info = INFO_CONTENT[type];
  if (!info) return null;

  return ReactDOM.createPortal(
    <div className="info-modal-overlay" onClick={onClose}>
      <div className="info-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="info-modal-header">
          <h3 className="info-modal-title">{info.title}</h3>
          <button className="info-modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="info-modal-body">
          {info.content.map((line, index) => (
            <p key={index} className="info-modal-text">
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default InfoModal;



