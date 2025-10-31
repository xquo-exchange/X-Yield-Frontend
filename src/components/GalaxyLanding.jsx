import React, { useEffect, useRef } from 'react';
import './GalaxyLanding.css';
import xquoLogo from '../assets/X-QUO white.svg';

const GalaxyLanding = ({ onConnect }) => {
  const canvasRef = useRef(null);
  const mousePos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const stars = useRef([]);
  const trail = useRef([]);
  const animationFrameId = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };
    
    // Initialize stars (fewer, white only)
    const initStars = () => {
      stars.current = [];
      const starCount = 1000;
      
      for (let i = 0; i < starCount; i++) {
        stars.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 1.5 + 0.3,
          vx: 0,
          vy: 0,
          originalX: 0,
          originalY: 0,
          opacity: Math.random() * 0.5 + 0.3
        });
        stars.current[i].originalX = stars.current[i].x;
        stars.current[i].originalY = stars.current[i].y;
      }
    };
    
    // Mouse move handler
    const handleMouseMove = (e) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      
      // Add to trail (limit length)
      trail.current.push({ 
        x: e.clientX, 
        y: e.clientY,
        opacity: 0.8,
        radius: 3
      });
      
      if (trail.current.length > 15) {
        trail.current.shift();
      }
    };
    
    // Animation loop (optimized)
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw and update trail
      trail.current.forEach((point, index) => {
        point.opacity *= 0.92;
        point.radius *= 0.95;
        
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${point.opacity})`;
        ctx.fill();
      });
      
      // Remove dead trail points
      trail.current = trail.current.filter(p => p.opacity > 0.05);
      
      // Draw and update stars
      stars.current.forEach((star) => {
        // Calculate distance from mouse
        const dx = mousePos.current.x - star.x;
        const dy = mousePos.current.y - star.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 100;
        
        if (distance < maxDistance) {
          const force = (maxDistance - distance) / maxDistance;
          const angle = Math.atan2(dy, dx);
          star.vx = -Math.cos(angle) * force * 3;
          star.vy = -Math.sin(angle) * force * 3;
        } else {
          star.vx += (star.originalX - star.x) * 0.02;
          star.vy += (star.originalY - star.y) * 0.02;
        }
        
        star.vx *= 0.85;
        star.vy *= 0.85;
        star.x += star.vx;
        star.y += star.vy;
        
        // Draw star
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.fill();
      });
      
      animationFrameId.current = requestAnimationFrame(animate);
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', handleMouseMove);
    animate();
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  return (
    <div className="galaxy-landing">
      <canvas ref={canvasRef} className="galaxy-canvas" />
      
      <div className="galaxy-content">
        <div className="galaxy-hero">
          <img src={xquoLogo} alt="X-QUO" className="galaxy-logo" />
          <p className="galaxy-subtitle">
            <span className="galaxy-shine" data-text="Connect wallet to continue">Connect wallet to continue</span>
          </p>
          
          <button 
            onClick={onConnect} 
            className="galaxy-connect-btn"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    </div>
  );
};

export default GalaxyLanding;
