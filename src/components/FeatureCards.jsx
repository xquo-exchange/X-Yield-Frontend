import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import './FeatureCards.css';
import coins3d from '../assets/coins-3d.png';
import rocket3d from '../assets/rocket-3d.png';
import shield3d from '../assets/shield-3d.png';

const FeatureCards = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);

  const cards = [
    {
      id: 1,
      image: coins3d,
      title: 'Earn Yield',
      description: 'Deposit USDC and earn competitive yields automatically'
    },
    {
      id: 2,
      image: rocket3d,
      title: 'Optimized Returns',
      description: 'Powered by Morpho Protocol for maximum efficiency'
    },
    {
      id: 3,
      image: shield3d,
      title: 'Secure & Safe',
      description: 'Built on Base with battle-tested smart contracts'
    },
    {
      id: 4,
      image: shield3d,
      title: 'Documentation',
      description: 'Learn more about unflat features and protocol',
      link: 'https://unflat.gitbook.io/unflat-doc/'
    }
  ];

  const toggleModal = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    setActiveIndex(0);
    
    if (newIsOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      toggleModal();
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % cards.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isOpen, cards.length]);

  // Handle scroll to close modal
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const handleScroll = (e) => {
      const container = containerRef.current;
      if (!container) return;
      
      const scrollTop = container.scrollTop;
      
      // Close modal if scrolled past the cards (scrolled down significantly)
      if (scrollTop > 100) {
        setIsOpen(false);
        setActiveIndex(0);
        document.body.style.overflow = '';
      }
    };

    const container = containerRef.current;
    container.addEventListener('scroll', handleScroll);
    
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, [isOpen]);

  // Cleanup: Reset body overflow when component unmounts
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <>
      <button 
        className="feature-cards-button"
        onClick={toggleModal}
        aria-label="View features"
      >
        <img src="/icon.svg" alt="unflat" className="feature-cards-button-icon" />
      </button>

      {isOpen && ReactDOM.createPortal(
        <div className="feature-cards-overlay" onClick={handleOverlayClick}>
          <div className="feature-cards-container" ref={containerRef} onClick={(e) => e.stopPropagation()}>
            <button 
              className="feature-cards-close"
              onClick={toggleModal}
              aria-label="Close"
            >
              <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </button>
            <div className="feature-cards-slider">
              {cards.map((card, index) => (
                <div
                  key={card.id}
                  className={`feature-card ${index === activeIndex ? 'active' : ''}`}
                  aria-hidden={index !== activeIndex}
                >
                  <div className="feature-card-inner">
                    <div className="feature-card-image-wrapper">
                      <img 
                        src={card.image} 
                        alt={card.title} 
                        className="feature-card-image"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <div className="feature-card-content">
                      <h3 className="feature-card-title">{card.title}</h3>
                      <p className="feature-card-description">{card.description}</p>
                      {card.link && (
                        <a 
                          href={card.link} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="feature-card-link"
                          style={{ 
                            display: 'inline-block', 
                            marginTop: '8px', 
                            color: '#10b981', 
                            textDecoration: 'none', 
                            fontWeight: '600',
                            fontSize: '14px'
                          }}
                        >
                          Read Docs →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="feature-cards-indicators" aria-hidden="true">
              {cards.map((card, index) => (
                <span
                  key={card.id}
                  className={`feature-cards-indicator ${index === activeIndex ? 'active' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default FeatureCards;

