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
  
  // Enhanced swipe detection for mobile - works even during vertical scroll
  const handleDragEnd = (event, info) => {
    const velocityThreshold = 300; // Minimum velocity for swipe (lowered for better sensitivity)
    const distanceThreshold = 50; // Minimum distance for swipe (lowered for better sensitivity)
    const horizontalRatio = 1.5; // Horizontal movement must be 1.5x vertical movement

    const horizontalDistance = Math.abs(info.offset.x);
    const verticalDistance = Math.abs(info.offset.y);
    const horizontalVelocity = Math.abs(info.velocity.x);
    const verticalVelocity = Math.abs(info.velocity.y);

    // Only trigger horizontal swipe if horizontal movement/velocity is dominant
    const isHorizontalSwipe = horizontalDistance > verticalDistance * horizontalRatio || 
                               horizontalVelocity > verticalVelocity * horizontalRatio;

    if (!isHorizontalSwipe) {
      return; // Ignore if it's primarily a vertical scroll
    }

    // Check velocity-based swipe (fast swipe)
    if (horizontalVelocity > velocityThreshold) {
      if (info.velocity.x > 0 && currentIndex > 0) {
        handlePrevious();
        return;
      } else if (info.velocity.x < 0 && currentIndex < cards.length - 1) {
        handleNext();
        return;
      }
    }

    // Check distance-based swipe (slow swipe)
    if (horizontalDistance > distanceThreshold) {
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
    // For double-faced cards
    if (isDoubleFaced && currentCard.card_faces) {
      if (canFlip && isFlipped) {
        // Back face
        return currentCard.card_faces[1]?.image_uris?.normal || 
               currentCard.card_faces[1]?.image_uris?.large || 
               currentCard.card_faces[1]?.image_uris?.png ||
               currentCard.image_uris?.normal;
      } else {
        // Front face
        return currentCard.card_faces[0]?.image_uris?.normal || 
               currentCard.card_faces[0]?.image_uris?.large || 
               currentCard.card_faces[0]?.image_uris?.png ||
               currentCard.image_uris?.normal;
      }
    }
    // For single-faced cards
    return currentCard?.image_uris?.normal || 
           currentCard?.image_uris?.large || 
           currentCard?.image_uris?.png ||
           currentCard?.card_faces?.[0]?.image_uris?.normal;
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
  const cardImageUrl = getCardImage();

  if (!currentCard) {
    console.warn('❌ CardViewer: No current card found');
    return null;
  }

  console.log('✅ CardViewer rendering:', { 
    currentIndex, 
    totalCards: cards.length, 
    cardName: currentCard.name,
    cardImageUrl,
    hasImageUris: !!currentCard.image_uris,
    hasCardFaces: !!currentCard.card_faces,
    isDoubleFaced,
    isFlipped
  });

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


          {/* Main Content - Desktop & Mobile Layout */}
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
            {/* Desktop: Left - Card Image */}
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

            {/* Desktop: Right - Card Details */}
            <div className="card-details">
              <div className="card-basic-info">
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
              </div>

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

              <div className="card-content">
                {cardInfo.oracle_text && (
                  <div className="card-text-box">
                    <div className="card-text-oracle">
                      <div dangerouslySetInnerHTML={{
                        __html: cardInfo.oracle_text.replace(/\n/g, '<br />')
                      }} />
                    </div>
                  </div>
                )}

                {cardInfo.flavor_text && (
                  <div className="card-text-flavor">
                    <div className="italic">{cardInfo.flavor_text}</div>
                  </div>
                )}

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

                <div className="card-detail-row">
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
                </div>

                {currentCard.legalities && (
                  <div className="card-legality-section">
                    <h4>Format Legality</h4>
                    <div className="legality-grid">
                      {Object.entries(currentCard.legalities)
                        .sort(([a], [b]) => {
                          const priority = ['standard', 'pioneer', 'modern', 'legacy', 'vintage', 'commander', 'pauper', 'paupercommander'];
                          const aPriority = priority.indexOf(a.toLowerCase());
                          const bPriority = priority.indexOf(b.toLowerCase());
                          if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
                          if (aPriority !== -1) return -1;
                          if (bPriority !== -1) return 1;
                          return a.localeCompare(b);
                        })
                        .map(([format, status]) => {
                          let displayName = format;
                          if (format === 'paupercommander') {
                            displayName = 'Pauper Commander';
                          } else if (format.includes('_')) {
                            displayName = format.replace(/_/g, ' ');
                          }
                          displayName = displayName.toUpperCase();

                          return (
                            <div key={format} className={`legality-item ${status.toLowerCase()}`}>
                              <span className="format-name">{displayName}</span>
                              <span className={`status status-${status.toLowerCase()}`}>{status}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

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
                      {(!currentCard.usd && !currentCard.usd_foil && !currentCard.eur && !currentCard.tix) && (
                        <tr>
                          <td colSpan="4" className="no-price-data">Price information not available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

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

            {/* Mobile: Single Scrollable Container - Everything scrolls together */}
            <div className="card-viewer-mobile-wrapper">
              {/* Card Image - Scrolls with content */}
              <div className="card-image-mobile">
                <motion.div
                  className={`card-image-wrapper ${canFlip ? 'double-faced' : ''}`}
                  animate={{ rotateY: canFlip && isFlipped ? 180 : 0 }}
                  transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
                >
                  {cardImageUrl ? (
                    <img
                      src={cardImageUrl}
                      alt={cardInfo.name || currentCard.name}
                      className="card-viewer-image"
                      onClick={() => canFlip && handleCardClick(currentCard.id)}
                      style={{ cursor: canFlip ? 'pointer' : 'default' }}
                      loading="eager"
                      onError={(e) => {
                        console.error('❌ Error loading card image:', cardImageUrl);
                        e.target.style.display = 'none';
                      }}
                      onLoad={() => {
                        console.log('✅ Card image loaded:', cardImageUrl);
                      }}
                    />
                  ) : (
                    <div className="card-image-placeholder">
                      <div className="placeholder-text">No image available</div>
                    </div>
                  )}
                </motion.div>
                {canFlip && (
                  <div className="flip-hint-mobile">Tap to flip</div>
                )}
              </div>

              {/* Navigation Indicator */}
              <div className="card-nav-mobile">
                <motion.button
                  className="nav-btn nav-btn-prev"
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  ‹
                </motion.button>
                <span className="nav-counter">Card {currentIndex + 1} of {cards.length}</span>
                <motion.button
                  className="nav-btn nav-btn-next"
                  onClick={handleNext}
                  disabled={currentIndex === cards.length - 1}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  ›
                </motion.button>
              </div>

              {/* All Content - Scrolls together */}
              <div className="card-content-mobile">
                {/* Card Name */}
                <div className="detail-section">
                  <div className="detail-header">
                    <svg className="detail-icon" width="16" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>
                    </svg>
                    <h2 className="detail-label">Card Name</h2>
                  </div>
                  <h1 className="detail-value detail-name">{cardInfo.name || currentCard.name}</h1>
                </div>

                {/* Mana Cost */}
                {cardInfo.mana_cost && (
                  <div className="detail-section">
                    <div className="detail-header">
                      <svg className="detail-icon" width="18" height="21" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="6" r="4" stroke="white" strokeWidth="2"/>
                        <circle cx="7" cy="20" r="4" stroke="white" strokeWidth="2"/>
                        <circle cx="5" cy="11" r="4" stroke="white" strokeWidth="2"/>
                        <circle cx="17" cy="20" r="4" stroke="white" strokeWidth="2"/>
                        <circle cx="19" cy="11" r="4" stroke="white" strokeWidth="2"/>
                      </svg>
                      <h2 className="detail-label">Mana Cost</h2>
                    </div>
                    <div className="detail-value detail-mana">{cardInfo.mana_cost}</div>
                  </div>
                )}

                {/* Type Line */}
                {cardInfo.type_line && (
                  <div className="detail-section">
                    <div className="detail-header">
                      <svg className="detail-icon" width="16" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m16 16-3 3 3 3M3 12h14.5a1 1 0 0 1 0 7H13M3 19h6M3 5h18"/>
                      </svg>
                      <h2 className="detail-label">Type</h2>
                    </div>
                    <div className="detail-value detail-type">{cardInfo.type_line}</div>
                  </div>
                )}

                <div className="detail-divider"></div>

                {/* Oracle Text */}
                {cardInfo.oracle_text && (
                  <div className="detail-section">
                    <div className="detail-header">
                      <svg className="detail-icon" width="16" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="5" y="2" width="14" height="20" rx="2"/>
                        <path d="M12.667 8 10 12h4l-2.667 4"/>
                      </svg>
                      <h2 className="detail-label">Rules Text</h2>
                    </div>
                    <div className="detail-value detail-oracle" dangerouslySetInnerHTML={{
                      __html: cardInfo.oracle_text.replace(/\n/g, '<br />')
                    }} />
                  </div>
                )}

                {cardInfo.flavor_text && (
                  <div className="detail-section">
                    <div className="detail-value detail-flavor">{cardInfo.flavor_text}</div>
                  </div>
                )}

                <div className="detail-divider"></div>

                {/* Stats and Info Grid */}
                <div className="detail-grid">
                  {/* Power/Toughness */}
                  {(cardInfo.power !== undefined && cardInfo.toughness !== undefined) && (
                    <div className="detail-section detail-section-small">
                      <div className="detail-header">
                        <svg className="detail-icon" width="16" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/>
                          <line x1="13" x2="19" y1="19" y2="13"/>
                        </svg>
                        <h2 className="detail-label">P/T</h2>
                      </div>
                      <div className="detail-value">{cardInfo.power}/{cardInfo.toughness}</div>
                    </div>
                  )}

                  {/* Loyalty */}
                  {cardInfo.loyalty && (
                    <div className="detail-section detail-section-small">
                      <div className="detail-header">
                        <svg className="detail-icon" width="16" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                        </svg>
                        <h2 className="detail-label">Loyalty</h2>
                      </div>
                      <div className="detail-value">{cardInfo.loyalty}</div>
                    </div>
                  )}

                  {/* Rarity */}
                  {currentCard.rarity && (
                    <div className="detail-section detail-section-small">
                      <div className="detail-header">
                        <svg className="detail-icon" width="16" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z"/>
                        </svg>
                        <h2 className="detail-label">Rarity</h2>
                      </div>
                      <div className={`detail-value rarity-${currentCard.rarity}`}>{currentCard.rarity}</div>
                    </div>
                  )}
                </div>

                {/* Set and Artist */}
                <div className="detail-grid">
                  {currentCard.set_name && (
                    <div className="detail-section detail-section-small">
                      <div className="detail-header">
                        <svg className="detail-icon" width="16" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                        </svg>
                        <h2 className="detail-label">Set</h2>
                      </div>
                      <div className="detail-value">{currentCard.set_name}</div>
                    </div>
                  )}

                  {cardInfo.artist && (
                    <div className="detail-section detail-section-small">
                      <div className="detail-header">
                        <svg className="detail-icon" width="16" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="m5 8 6 6m-4-6 6 6-6-6 2-3M2 5h12M7 2h1"/>
                        </svg>
                        <h2 className="detail-label">Artist</h2>
                      </div>
                      <div className="detail-value">{cardInfo.artist}</div>
                    </div>
                  )}
                </div>

                {/* Format Legality */}
                {currentCard.legalities && (
                  <div className="detail-section">
                    <div className="detail-header">
                      <svg className="detail-icon" width="16" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21.801 10A10 10 0 1 1 17 3.335"/>
                        <path d="m9 11 3 3L22 4"/>
                      </svg>
                      <h2 className="detail-label">Legal Formats</h2>
                    </div>
                    <div className="legality-list-mobile">
                      {Object.entries(currentCard.legalities)
                        .filter(([_, status]) => status.toLowerCase() === 'legal')
                        .sort(([a], [b]) => {
                          const priority = ['standard', 'pioneer', 'modern', 'legacy', 'vintage', 'commander', 'pauper'];
                          const aPriority = priority.indexOf(a.toLowerCase());
                          const bPriority = priority.indexOf(b.toLowerCase());
                          if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
                          if (aPriority !== -1) return -1;
                          if (bPriority !== -1) return 1;
                          return a.localeCompare(b);
                        })
                        .map(([format]) => {
                          let displayName = format === 'paupercommander' ? 'Pauper Commander' : format.replace(/_/g, ' ');
                          displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
                          return <span key={format} className="legality-tag legal">{displayName}</span>;
                        })}
                    </div>
                  </div>
                )}

                {/* Official Rulings */}
                {currentCard.rulings && currentCard.rulings.length > 0 && (
                  <div className="detail-section">
                    <div className="detail-header">
                      <svg className="detail-icon" width="16" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Zm2 5h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>
                      </svg>
                      <h2 className="detail-label">Rulings</h2>
                    </div>
                    <div className="rulings-list-mobile">
                      {currentCard.rulings.map((ruling, index) => (
                        <div key={index} className="ruling-item-mobile">
                          <div className="ruling-date-mobile">({ruling.published_at})</div>
                          <div className="ruling-text-mobile">{ruling.comment}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* End Mobile Wrapper */}

            {/* Desktop Navigation Arrows */}
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
      </motion.div>
    </AnimatePresence>
  );
}

export default CardViewer;

