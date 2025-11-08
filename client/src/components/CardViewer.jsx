import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useDragControls } from 'framer-motion';
import './CardViewer.css';

function CardViewer({ cards, initialIndex, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
  const [flippedCardId, setFlippedCardId] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
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
  
  // Swipe detection
  const handleDragEnd = (event, info) => {
    const threshold = 50;
    if (info.offset.x > threshold && currentIndex > 0) {
      handlePrevious();
    } else if (info.offset.x < -threshold && currentIndex < cards.length - 1) {
      handleNext();
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
  
  // Get current face image (front or back)
  const getCardImage = () => {
    if (isDoubleFaced) {
      const face = isFlipped ? currentCard.card_faces[1] : currentCard.card_faces[0];
      return face.image_uris?.normal || face.image_uris?.large || currentCard.image_uris?.normal;
    }
    return currentCard?.image_uris?.normal || currentCard?.image_uris?.large || currentCard?.image_uris?.png;
  };

  const getCardInfo = () => {
    if (isDoubleFaced && isFlipped) {
      return currentCard.card_faces[1];
    } else if (isDoubleFaced) {
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

          {/* Tabs Navigation */}
          <div className="card-viewer-tabs">
            {[
              { id: 'details', label: 'Details', icon: '📋' },
              { id: 'legality', label: 'Legality', icon: '⚖️' },
              { id: 'price', label: 'Price', icon: '💰' },
              { id: 'rulings', label: 'Rulings', icon: '📖' }
            ].map(tab => (
              <motion.button
                key={tab.id}
                className={`card-viewer-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </motion.button>
            ))}
          </div>

          {/* Main Content */}
          <motion.div 
            className="card-viewer-content"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            dragControls={dragControls}
          >
            {/* Left: Card Image */}
            <div className="card-viewer-image-container">
              <motion.div
                className={`card-image-wrapper ${isDoubleFaced ? 'double-faced' : ''}`}
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
              >
                <img
                  src={getCardImage()}
                  alt={cardInfo.name || currentCard.name}
                  className="card-viewer-image"
                  onClick={() => isDoubleFaced && handleCardClick(currentCard.id)}
                  style={{ cursor: isDoubleFaced ? 'pointer' : 'default' }}
                />
              </motion.div>
              
              {/* Flip indicator for double-faced cards */}
              {isDoubleFaced && (
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

            {/* Right: Card Info with Tabs */}
            <div className="card-viewer-info">
              <AnimatePresence mode="wait">
                {activeTab === 'details' && (
                  <motion.div
                    key={`details-${currentCard.id}`}
                    className="tab-content"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h2 className="card-viewer-name">{cardInfo.name || currentCard.name}</h2>

                    {cardInfo.mana_cost && (
                      <div className="card-viewer-mana">
                        <span className="label">Mana Cost:</span>
                        <span className="value">{cardInfo.mana_cost}</span>
                      </div>
                    )}

                    {cardInfo.type_line && (
                      <div className="card-viewer-type">
                        <span className="label">Type:</span>
                        <span className="value">{cardInfo.type_line}</span>
                      </div>
                    )}

                    {cardInfo.oracle_text && (
                      <div className="card-viewer-text">
                        <span className="label">Oracle Text:</span>
                        <div className="value" dangerouslySetInnerHTML={{
                          __html: cardInfo.oracle_text.replace(/\n/g, '<br />')
                        }} />
                      </div>
                    )}

                    {cardInfo.flavor_text && (
                      <div className="card-viewer-flavor">
                        <span className="label">Flavor Text:</span>
                        <div className="value italic">{cardInfo.flavor_text}</div>
                      </div>
                    )}

                    {cardInfo.power !== undefined && cardInfo.toughness !== undefined && (
                      <div className="card-viewer-stats">
                        <span className="label">Power/Toughness:</span>
                        <span className="value">{cardInfo.power}/{cardInfo.toughness}</span>
                      </div>
                    )}

                    {cardInfo.loyalty && (
                      <div className="card-viewer-loyalty">
                        <span className="label">Loyalty:</span>
                        <span className="value">{cardInfo.loyalty}</span>
                      </div>
                    )}

                    {currentCard.set_name && (
                      <div className="card-viewer-set">
                        <span className="label">Set:</span>
                        <span className="value">{currentCard.set_name}</span>
                      </div>
                    )}

                    {currentCard.rarity && (
                      <div className="card-viewer-rarity">
                        <span className="label">Rarity:</span>
                        <span className={`value rarity-${currentCard.rarity}`}>{currentCard.rarity}</span>
                      </div>
                    )}

                    {cardInfo.artist && (
                      <div className="card-viewer-artist">
                        <span className="label">Artist:</span>
                        <span className="value">{cardInfo.artist}</span>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'legality' && (
                  <motion.div
                    key={`legality-${currentCard.id}`}
                    className="tab-content"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3>Format Legality</h3>
                    {currentCard.legalities ? (
                      <div className="legality-grid">
                        {Object.entries(currentCard.legalities).map(([format, status]) => (
                          <div key={format} className={`legality-item ${status.toLowerCase()}`}>
                            <span className="format-name">{format.replace(/_/g, ' ').toUpperCase()}</span>
                            <span className={`status status-${status.toLowerCase()}`}>{status}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="no-data">No legality information available</div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'price' && (
                  <motion.div
                    key={`price-${currentCard.id}`}
                    className="tab-content"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3>Price Information</h3>
                    <div className="price-info">
                      {currentCard.usd && (
                        <div className="price-item">
                          <span className="label">USD:</span>
                          <span className="value">${currentCard.usd}</span>
                        </div>
                      )}
                      {currentCard.usd_foil && (
                        <div className="price-item">
                          <span className="label">USD Foil:</span>
                          <span className="value">${currentCard.usd_foil}</span>
                        </div>
                      )}
                      {currentCard.eur && (
                        <div className="price-item">
                          <span className="label">EUR:</span>
                          <span className="value">€{currentCard.eur}</span>
                        </div>
                      )}
                      {currentCard.tix && (
                        <div className="price-item">
                          <span className="label">MTGO Tix:</span>
                          <span className="value">{currentCard.tix}</span>
                        </div>
                      )}
                      {!currentCard.usd && !currentCard.usd_foil && !currentCard.eur && !currentCard.tix && (
                        <div className="no-data">No price information available</div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'rulings' && (
                  <motion.div
                    key={`rulings-${currentCard.id}`}
                    className="tab-content"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3>Official Rulings</h3>
                    {currentCard.rulings && currentCard.rulings.length > 0 ? (
                      <div className="rulings-list">
                        {currentCard.rulings.map((ruling, index) => (
                          <div key={index} className="ruling-item">
                            <div className="ruling-date">{ruling.published_at}</div>
                            <div className="ruling-text">{ruling.comment}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="no-data">No rulings available for this card</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Thumbnail Navigation */}
          <div className="card-viewer-thumbnails">
            <motion.button
              className="thumbnail-nav thumbnail-nav-prev"
              onClick={() => {
                const startIndex = Math.max(0, currentIndex - 2);
                const thumbnails = cards.slice(startIndex, startIndex + 5);
                // Scroll to show more thumbnails on the left if possible
                if (startIndex > 0) {
                  handlePrevious();
                }
              }}
              disabled={currentIndex === 0}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              ‹
            </motion.button>

            <div className="thumbnail-container">
              {(() => {
                const startIndex = Math.max(0, Math.min(currentIndex - 2, cards.length - 5));
                const visibleThumbnails = cards.slice(startIndex, startIndex + 5);

                return visibleThumbnails.map((card, idx) => {
                  const actualIndex = startIndex + idx;
                  const isActive = actualIndex === currentIndex;

                  return (
                    <motion.div
                      key={`thumb-${card.id}-${actualIndex}`}
                      className={`thumbnail-item ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setCurrentIndex(actualIndex);
                        setFlippedCardId(null);
                      }}
                      whileHover={{ scale: 1.1, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <img
                        src={card.image_uris?.small || card.image_uris?.normal}
                        alt={card.name}
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/75x105/1a1a1a/666?text=No+Image';
                        }}
                      />
                      {isActive && <div className="thumbnail-indicator" />}
                    </motion.div>
                  );
                });
              })()}
            </div>

            <motion.button
              className="thumbnail-nav thumbnail-nav-next"
              onClick={() => {
                const endIndex = Math.min(cards.length, currentIndex + 3);
                const thumbnails = cards.slice(Math.max(0, endIndex - 5), endIndex);
                // Scroll to show more thumbnails on the right if possible
                if (endIndex < cards.length) {
                  handleNext();
                }
              }}
              disabled={currentIndex === cards.length - 1}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              ›
            </motion.button>
          </div>

          {/* Navigation Arrows */}
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

