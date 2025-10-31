import React, { useEffect } from 'react';
import './Toast.css';
import { FaCheckCircle, FaExclamationTriangle, FaTimes } from 'react-icons/fa';

const Toast = ({ type = 'success', message, onClose, duration = 3000, txHash = null }) => {
  useEffect(() => {
    if (duration) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getIcon = () => {
    if (type === 'success') return <FaCheckCircle className="toast-icon success" />;
    return <FaExclamationTriangle className="toast-icon error" />;
  };

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-content">
        {getIcon()}
        <div className="toast-message">
          <p>{message}</p>
          {txHash && (
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="toast-link"
            >
              Open in Explorer →
            </a>
          )}
        </div>
      </div>
      <button className="toast-close" onClick={onClose}>
        <FaTimes />
      </button>
    </div>
  );
};

export default Toast;

