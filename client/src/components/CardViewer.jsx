import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useDragControls } from 'framer-motion';
import './CardViewer.css';

function CardViewer({ cards, initialIndex, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
  const [flippedCardId, setFlippedCardId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const x = useMotionValue(0);
  const dragControls = useDragControls();

  const currentCard = cards[currentIndex];

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setFlippedCardId(null); // Reset flip when changing card
    }
  };

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setFlippedCardId(null); // Reset flip when changing card
    }
  };
  
  // Enhanced swipe detection for mobile
  const handleDragEnd = (event, info) => {
    const velocityThreshold = 500; // Minimum velocity for swipe
    const distanceThreshold = 75; // Minimum distance for swipe

    // Check velocity-based swipe (fast swipe)
    if (Math.abs(info.velocity.x) > velocityThreshold) {
      if (info.velocity.x > 0 && currentIndex > 0) {
        handlePrevious();
        return;
      } else if (info.velocity.x < 0 && currentIndex < cards.length - 1) {
        handleNext();
        return;
      }
    }

    // Check distance-based swipe (slow swipe)
    if (Math.abs(info.offset.x) > distanceThreshold) {
      if (info.offset.x > 0 && currentIndex > 0) {
        handlePrevious();
      } else if (info.offset.x < 0 && currentIndex < cards.length - 1) {
        handleNext();
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, onClose]);

  const handleCardClick = (cardId) => {
    if (flippedCardId === cardId) {
      setFlippedCardId(null);
    } else {
      setFlippedCardId(cardId);
    }
  };

  const isDoubleFaced = currentCard?.card_faces && currentCard.card_faces.length === 2;
  const isFlipped = flippedCardId === currentCard?.id;

  // Check if card should allow flipping (adventure cards and omen cards don't flip)
  const canFlip = isDoubleFaced && currentCard?.card_faces?.[0]?.type_line &&
    !currentCard.card_faces[0].type_line.toLowerCase().includes('adventure') &&
    !currentCard.card_faces[0].type_line.toLowerCase().includes('omen');
  
  // Get current face image (front or back)
  const getCardImage = () => {
    if (canFlip && isFlipped) {
      return currentCard.card_faces[1].image_uris?.normal || currentCard.card_faces[1].image_uris?.large || currentCard.image_uris?.normal;
    }
    return currentCard?.image_uris?.normal || currentCard?.image_uris?.large || currentCard?.image_uris?.png;
  };

  const getCardInfo = () => {
    if (canFlip && isFlipped) {
      return currentCard.card_faces[1];
    } else if (canFlip) {
      return currentCard.card_faces[0];
    }
    return currentCard;
  };

  const cardInfo = getCardInfo();

  if (!currentCard) {
    console.warn('❌ CardViewer: No current card found');
    return null;
  }

  console.log('✅ CardViewer rendering:', { currentIndex, totalCards: cards.length, cardName: currentCard.name });

  return (
    <AnimatePresence mode="wait">
      <motion.div
        className="card-viewer-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="card-viewer-container"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <motion.button
            className="card-viewer-close"
            onClick={onClose}
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.2 }}
          >
            ✕
          </motion.button>

          {/* Progress Bar */}
          <div className="card-viewer-progress">
            <div
              className="card-viewer-progress-bar"
              style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
            />
            <span className="card-viewer-progress-text">
              {currentIndex + 1} / {cards.length}
            </span>
          </div>


          {/* Main Content - Scryfall-inspired Layout */}
          <motion.div
            className="card-viewer-content"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.3}
            dragMomentum={false}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={(event, info) => {
              setIsDragging(false);
              handleDragEnd(event, info);
            }}
            dragControls={dragControls}
            whileDrag={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Left: Card Image */}
            <div className="card-image">
              <div className="card-image-front">
                <motion.div
                  className={`card-image-wrapper ${canFlip ? 'double-faced' : ''}`}
                  animate={{ rotateY: canFlip && isFlipped ? 180 : 0 }}
                  transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
                >
                  <img
                    src={getCardImage()}
                    alt={cardInfo.name || currentCard.name}
                    className="card-viewer-image"
                    onClick={() => canFlip && handleCardClick(currentCard.id)}
                    style={{ cursor: canFlip ? 'pointer' : 'default' }}
                    loading="eager"
                  />
                </motion.div>

                {/* Flip indicator for double-faced cards that can flip */}
                {canFlip && (
                  <motion.div
                    className="flip-indicator"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <span>Click to flip</span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Right: Card Details */}
            <div className="card-details">
              {/* Card Text */}
              <div className="card-text">
                <h1 className="card-text-title">
                  <span className="card-text-card-name">
                    {cardInfo.name || currentCard.name}
                  </span>
                  {cardInfo.mana_cost && (
                    <span className="card-text-mana-cost">{cardInfo.mana_cost}</span>
                  )}
                </h1>

                {cardInfo.type_line && (
                  <p className="card-text-type-line">
                    {cardInfo.type_line}
                  </p>
                )}

                <div className="card-text-box">
                  {cardInfo.oracle_text && (
                    <div className="card-text-oracle">
                      <div dangerouslySetInnerHTML={{
                        __html: cardInfo.oracle_text.replace(/\n/g, '<br />')
                      }} />
                    </div>
                  )}

                  {cardInfo.flavor_text && (
                    <div className="card-text-flavor">
                      <div className="italic">{cardInfo.flavor_text}</div>
                    </div>
                  )}
                </div>

                {(cardInfo.power !== undefined && cardInfo.toughness !== undefined) && (
                  <div className="card-text-stats">
                    {cardInfo.power}/{cardInfo.toughness}
                  </div>
                )}

                {cardInfo.loyalty && (
                  <div className="card-text-loyalty">
                    Loyalty: {cardInfo.loyalty}
                  </div>
                )}

                {cardInfo.artist && (
                  <p className="card-text-artist">
                    Illustrated by {cardInfo.artist}
                  </p>
                )}

                {/* Additional Information */}
                {currentCard.set_name && (
                  <div className="card-detail-item">
                    <span className="label">Set:</span>
                    <span className="value">{currentCard.set_name}</span>
                  </div>
                )}

                {currentCard.rarity && (
                  <div className="card-detail-item">
                    <span className="label">Rarity:</span>
                    <span className={`value rarity-${currentCard.rarity}`}>{currentCard.rarity}</span>
                  </div>
                )}

                {/* Format Legality */}
                {currentCard.legalities && (
                  <div className="card-legality-section">
                    <h4>Format Legality</h4>
                    <div className="legality-grid">
                      {Object.entries(currentCard.legalities).map(([format, status]) => (
                        <div key={format} className={`legality-item ${status.toLowerCase()}`}>
                          <span className="format-name">{format.replace(/_/g, ' ').toUpperCase()}</span>
                          <span className={`status status-${status.toLowerCase()}`}>{status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price Information */}
                <div className="card-price-section">
                  <h4>Price Information</h4>
                  <table className="prints-table">
                    <thead>
                      <tr>
                        <th>Prints</th>
                        <th>USD</th>
                        <th>EUR</th>
                        <th>TIX</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="current">
                        <td>
                          <div className="print-info">
                            <span className="set-name">{currentCard.set_name}</span>
                            <span className="card-number">#{currentCard.collector_number}</span>
                          </div>
                        </td>
                        <td>{currentCard.usd ? `$${currentCard.usd}` : '-'}</td>
                        <td>{currentCard.eur ? `€${currentCard.eur}` : '-'}</td>
                        <td>{currentCard.tix || '-'}</td>
                      </tr>
                      {currentCard.usd_foil && (
                        <tr>
                          <td>
                            <div className="print-info">
                              <span className="set-name">{currentCard.set_name} (Foil)</span>
                              <span className="card-number">#{currentCard.collector_number}</span>
                            </div>
                          </td>
                          <td>${currentCard.usd_foil}</td>
                          <td>-</td>
                          <td>-</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Official Rulings */}
                {currentCard.rulings && currentCard.rulings.length > 0 && (
                  <div className="card-rulings-section">
                    <h4>Official Rulings</h4>
                    <div className="rulings-list">
                      {currentCard.rulings.map((ruling, index) => (
                        <div key={index} className="ruling-item">
                          <div className="ruling-date">{ruling.published_at}</div>
                          <div className="ruling-text">{ruling.comment}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Swipe Hint for Mobile */}
          <AnimatePresence>
            {isDragging && (
              <motion.div
                className="swipe-hint"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="swipe-hint-icon">↔️</div>
                <div className="swipe-hint-text">Swipe to navigate</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Swipe Indicators Dots */}
          <div className="swipe-indicators">
            {cards.slice(0, 5).map((_, index) => (
              <div
                key={index}
                className={`swipe-dot ${index === Math.min(currentIndex, 4) ? 'active' : ''}`}
              />
            ))}
            {cards.length > 5 && <div className="swipe-dot">⋯</div>}
          </div>

          {/* Compact Navigation Indicator - Repositioned between card and tabs */}
          <div className="card-viewer-nav-indicator">
            <motion.button
              className="nav-arrow nav-arrow-prev"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              whileHover={{ scale: 1.1, backgroundColor: 'rgba(59, 130, 246, 0.2)' }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              ‹
            </motion.button>

            <div className="nav-position">
              <span className="position-text">Card {currentIndex + 1} of {cards.length}</span>
            </div>

            <motion.button
              className="nav-arrow nav-arrow-next"
              onClick={handleNext}
              disabled={currentIndex === cards.length - 1}
              whileHover={{ scale: 1.1, backgroundColor: 'rgba(59, 130, 246, 0.2)' }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              ›
            </motion.button>
          </div>

          {/* Navigation Arrows - Hidden on mobile, swipe gestures used instead */}
          <motion.button
            className="card-viewer-nav card-viewer-nav-prev"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            whileHover={{ scale: 1.1, x: -5 }}
            whileTap={{ scale: 0.9 }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            ←
          </motion.button>

          <motion.button
            className="card-viewer-nav card-viewer-nav-next"
            onClick={handleNext}
            disabled={currentIndex === cards.length - 1}
            whileHover={{ scale: 1.1, x: 5 }}
            whileTap={{ scale: 0.9 }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            →
          </motion.button>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default CardViewer;

