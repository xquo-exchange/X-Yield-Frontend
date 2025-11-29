import morphoLogo from '../assets/morpho-logo.png';
import './PoweredByMorpho.css';

const PoweredByMorpho = ({ className = "" }) => {
    return (
        <div className={`powered-by-morpho ${className}`} style={{ color: '#8ba1be' }}>
            <span className="powered-by-morpho-text">Powered by</span>
            <img src={morphoLogo} alt="Morpho" className="powered-by-morpho-logo" />
        </div>
    );
};

export default PoweredByMorpho;
