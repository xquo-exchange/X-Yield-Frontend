import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = ({ variant = 'app' }) => {
  const classes = [
    'footer',
    variant === 'landing' ? 'footer--landing' : 'footer--app'
  ].join(' ');

  return (
    <footer className={classes}>
      <Link to="/privacy-policy" className="footer-link">
        Privacy Policy
      </Link>
    </footer>
  );
};

export default Footer;

