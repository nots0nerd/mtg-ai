import { useState } from 'react';
import axios from 'axios';
import FilterBar from './components/FilterBar';
import './App.css';

function App() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [allCards, setAllCards] = useState([]); // Tutte le carte ricevute
  const [displayCards, setDisplayCards] = useState([]); // Solo le carte da mostrare
  const [error, setError] = useState(null);
  const [scryfallQuery, setScryfallQuery] = useState('');
  const [lastSearchPrompt, setLastSearchPrompt] = useState('');
  const [filters, setFilters] = useState({
    format: 'all',
    order: 'auto',
    direction: 'auto'
  });
  const [pagination, setPagination] = useState({
    totalCards: 0,
    currentPage: 1,
    hasMore: false,
    totalPages: 0,
    isClientPagination: false
  });

  const handleSearch = async (pageNum = 1) => {
    const searchPrompt = prompt.trim();
    if (!searchPrompt && !lastSearchPrompt) {
      return;
    }

    // Usa il prompt corrente o l'ultimo prompt salvato per la paginazione
    const promptToUse = searchPrompt || lastSearchPrompt;
    const isNewSearch = !!searchPrompt;

    setLoading(true);
    setError(null);
    
    // Se è una nuova ricerca, resetta tutto
    if (isNewSearch) {
      setResults(null);
      setAllCards([]);
      setDisplayCards([]);
      setScryfallQuery('');
      setLastSearchPrompt(promptToUse);
      setPagination({
        totalCards: 0,
        currentPage: 1,
        hasMore: false,
        totalPages: 0,
        isClientPagination: false
      });
    }

    try {
      // 🔍 Log per debug
      console.log('📤 Sending to API:', {
        message: promptToUse,
        format: filters.format,
        order: filters.order,
        direction: filters.direction,
        page: pageNum
      });

      const apiUrl = import.meta.env.DEV 
        ? 'http://localhost:3001/api/search'
        : '/api/search';
      
      const response = await axios.post(apiUrl, {
        prompt: promptToUse,
        format: filters.format,
        order: filters.order,
        direction: filters.direction,
        page: pageNum
      });

      setScryfallQuery(response.data.scryfall_query);
      
      const cards = response.data.results || [];
      const totalCards = response.data.pagination?.totalCards || cards.length;
      const receivedCards = cards.length;
      
      console.log('📦 Received cards:', receivedCards, 'of', totalCards);
      console.log('🔍 isClientPagination flag:', response.data.pagination?.isClientPagination);
      
      // 🆕 Se l'API ha flaggato come client-side pagination O se abbiamo tutte le carte
      const needsClientPagination = response.data.pagination?.isClientPagination || 
                                    (receivedCards === totalCards && totalCards > 20);
      
      if (needsClientPagination) {
        console.log('🔄 Client-side pagination needed');
        
        // Salva tutte le carte
        setAllCards(cards);
        
        // Mostra solo le prime 20
        setDisplayCards(cards.slice(0, 20));
        
        // Calcola pagine client-side
        const clientTotalPages = Math.ceil(totalCards / 20);
        
        setPagination({
          totalCards: totalCards,
          currentPage: 1,
          hasMore: clientTotalPages > 1,
          totalPages: clientTotalPages,
          cardsInPage: 20,
          isClientPagination: true
        });
        
        setResults(cards); // Per compatibilità
      } else {
        // Pagination normale server-side o meno di 20 carte
        setAllCards(cards);
        setDisplayCards(cards);
        setResults(cards);
        
        if (response.data.pagination) {
          setPagination({
            ...response.data.pagination,
            isClientPagination: false
          });
        }
      }
    } catch (err) {
      // Gestisce errori in formato stringa o oggetto
      let errorMessage = 'Errore durante la ricerca delle carte';
      
      if (err.response?.data) {
        // Se data è una stringa, usala direttamente
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        }
        // Se data è un oggetto, estrai error o message
        else if (err.response.data.error) {
          errorMessage = typeof err.response.data.error === 'string' 
            ? err.response.data.error 
            : JSON.stringify(err.response.data.error);
        }
        else if (err.response.data.message) {
          errorMessage = typeof err.response.data.message === 'string'
            ? err.response.data.message
            : JSON.stringify(err.response.data.message);
        }
        else if (err.response.data.details) {
          errorMessage = typeof err.response.data.details === 'string'
            ? err.response.data.details
            : JSON.stringify(err.response.data.details);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPage = async (newPage) => {
    console.log('🔄 loadPage called:', { 
      newPage, 
      currentPage: pagination.currentPage, 
      totalPages: pagination.totalPages, 
      isClientPagination: pagination.isClientPagination,
      allCardsLength: allCards.length
    });
    
    if (newPage < 1 || (pagination.totalPages > 0 && newPage > pagination.totalPages)) {
      console.log('⚠️ Invalid page number, returning');
      return;
    }
    
    setLoading(true);
    
    try {
      // 🆕 Se è pagination client-side
      if (pagination.isClientPagination && allCards.length > 0) {
        console.log('📄 Client-side page change:', newPage, 'allCards:', allCards.length);
        
        // Calcola indici
        const startIndex = (newPage - 1) * 20;
        const endIndex = startIndex + 20;
        
        // Verifica che abbiamo abbastanza carte
        if (startIndex >= allCards.length) {
          console.warn('⚠️ Start index exceeds allCards length:', { startIndex, allCardsLength: allCards.length });
          setLoading(false);
          return;
        }
        
        // Mostra le carte della pagina richiesta
        const cardsToDisplay = allCards.slice(startIndex, endIndex);
        console.log('📋 Displaying cards:', { startIndex, endIndex, cardsCount: cardsToDisplay.length });
        
        setDisplayCards(cardsToDisplay);
        
        // Aggiorna stato paginazione
        const updatedPagination = {
          ...pagination,
          currentPage: newPage,
          hasMore: newPage < pagination.totalPages
        };
        
        console.log('✅ Client-side pagination updated:', updatedPagination);
        
        setPagination(updatedPagination);
        
        setLoading(false);
        return;
      }
      
      // Altrimenti, pagination server-side normale
      const promptToUse = lastSearchPrompt || prompt.trim();
      if (!promptToUse) {
        setLoading(false);
        return;
      }

      const apiUrl = import.meta.env.DEV 
        ? 'http://localhost:3001/api/search'
        : '/api/search';
      
      const response = await axios.post(apiUrl, {
        prompt: promptToUse,
        format: filters.format,
        order: filters.order,
        direction: filters.direction,
        page: newPage
      });

      // 🆕 Gestione errore 400 (pagina non esiste)
      if (response.status === 400 || response.data.error === 'Page does not exist') {
        console.warn('⚠️ Page does not exist:', response.data.message);
        // Torna alla prima pagina
        if (newPage > 1) {
          await loadPage(1);
        }
        return;
      }

      setScryfallQuery(response.data.scryfall_query);
      const cards = response.data.results || [];
      const totalCards = response.data.pagination?.totalCards || cards.length;
      const receivedCards = cards.length;
      
      console.log('📦 loadPage - Received cards:', receivedCards, 'of', totalCards);
      
      // Se Scryfall ha mandato TUTTE le carte (pagination client-side)
      // OPPURE se abbiamo già allCards e stiamo facendo paginazione
      if ((receivedCards === totalCards && totalCards > 20) || (allCards.length > 0 && allCards.length === totalCards)) {
        console.log('🔄 Using client-side pagination');
        
        // Se abbiamo già tutte le carte in allCards, usa quelle
        const cardsToUse = allCards.length > 0 && allCards.length === totalCards ? allCards : cards;
        
        // Se non abbiamo ancora salvato tutte le carte, salvele
        if (allCards.length !== totalCards) {
          setAllCards(cardsToUse);
        }
        
        // Calcola quale slice mostrare basato su newPage
        const startIndex = (newPage - 1) * 20;
        const endIndex = startIndex + 20;
        setDisplayCards(cardsToUse.slice(startIndex, endIndex));
        
        // Calcola pagine client-side
        const clientTotalPages = Math.ceil(totalCards / 20);
        
        setPagination({
          totalCards: totalCards,
          currentPage: newPage,
          hasMore: newPage < clientTotalPages,
          totalPages: clientTotalPages,
          cardsInPage: Math.min(20, totalCards - startIndex),
          isClientPagination: true
        });
        
        setResults(cardsToUse);
        setLoading(false);
        return;
      }
      
      // Limita displayCards a 20 per sicurezza (server-side pagination)
      const cardsToShow = cards.slice(0, 20);
      
      setAllCards(cards);
      setDisplayCards(cardsToShow);
      setResults(cards);
      
      // Aggiorna paginazione
      if (response.data.pagination) {
        setPagination({
          ...response.data.pagination,
          isClientPagination: false
        });
        console.log('📄 Updated pagination:', response.data.pagination);
      }
    } catch (err) {
      // Se l'errore è 400 (pagina non esiste), gestiscilo
      if (err.response?.status === 400) {
        console.warn('⚠️ Page does not exist');
        if (newPage > 1) {
          await loadPage(1);
        }
        return;
      }
      
      setError(
        err.response?.data?.error || 
        err.message || 
        'Errore durante il caricamento della pagina'
      );
      console.error('Error loading page:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      handleSearch(1);
    }
  };

  const handleSearchClick = () => {
    handleSearch(1);
  };

  // Componente per controlli paginazione
  function PaginationControls({ showButtons = true }) {
    const canGoPrevious = pagination.currentPage > 1 && !loading;
    const canGoNext = (pagination.currentPage < pagination.totalPages || pagination.hasMore) && !loading;

    console.log('🔘 Button state:', {
      currentPage: pagination.currentPage,
      totalPages: pagination.totalPages,
      hasMore: pagination.hasMore,
      canGoPrevious,
      canGoNext
    });

    return (
      <div className="pagination-container">
        {/* INFO SEMPRE VISIBILE */}
        <div className="pagination-info">
          <p className="total-cards">
            Found <strong>{pagination.totalCards}</strong> cards
            {pagination.totalCards > 20 && (
              <span className="page-range">
                {' '}(showing {(pagination.currentPage - 1) * 20 + 1}-
                {Math.min(pagination.currentPage * 20, pagination.totalCards)})
              </span>
            )}
            {pagination.totalCards > 0 && pagination.totalCards <= 20 && (
              <span className="page-range">
                {' '}(showing 1-{pagination.totalCards})
              </span>
            )}
          </p>
        </div>

        {/* BOTTONI SOLO SE CI SONO PIÙ PAGINE E showButtons è true */}
        {showButtons && pagination.totalPages > 1 && (
          <div className="pagination-controls">
            <button
              onClick={(e) => {
                e.preventDefault();
                console.log('🔵 Previous clicked, currentPage:', pagination.currentPage);
                loadPage(pagination.currentPage - 1);
              }}
              disabled={!canGoPrevious}
              className="pagination-btn"
            >
              ← Previous
            </button>

            <span className="page-info">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>

            <button
              onClick={(e) => {
                e.preventDefault();
                console.log('🔵 Next clicked, currentPage:', pagination.currentPage, 'totalPages:', pagination.totalPages);
                loadPage(pagination.currentPage + 1);
              }}
              disabled={!canGoNext}
              className="pagination-btn"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container">
        {/* Header */}
        <div className="header">
          <h1 className="title">MTG AI Search</h1>
          <p className="subtitle">Cerca carte Magic: The Gathering con l'AI</p>
        </div>

        {/* Filter Bar */}
        <FilterBar onFiltersChange={handleFiltersChange} filters={filters} />

        {/* Search Section */}
        <div className="search-section">
          <div className="search-container">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., creatures with flying"
              className="search-input"
              disabled={loading}
            />
            <button
              onClick={handleSearchClick}
              disabled={loading || !prompt.trim()}
              className="search-button"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="error">
            <div className="error-title">Errore:</div>
            <div>{error}</div>
          </div>
        )}

        {/* Scryfall Query */}
        {scryfallQuery && !loading && (
          <div className="query-display">
            <div className="query-label">Query Scryfall:</div>
            <div className="query-text">{scryfallQuery}</div>
          </div>
        )}

        {/* Pagination Info - TOP */}
        {pagination.totalCards > 0 && !loading && (
          <PaginationControls showButtons={true} />
        )}

        {/* Results Grid */}
        {displayCards.length > 0 && !loading && (
          <div className="results">
            <div className="results-count">
              Mostrando <span>{displayCards.length}</span> carte{pagination.totalCards > 0 ? ` su ${pagination.totalCards} totali` : ''}
            </div>
            <div className="results-grid">
              {displayCards.map((card) => (
                  <div key={card.id} className="card-item">
                    {/* Card Image */}
                    {card.image_uris?.normal && (
                      <div className="card-image-container">
                        <img
                          src={card.image_uris.normal}
                          alt={card.name}
                          className="card-image"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/300x420/1a1a1a/666?text=No+Image';
                          }}
                        />
                      </div>
                    )}

                    {/* Card Info */}
                    <div className="card-info">
                      {/* Mana Cost */}
                      {card.mana_cost && (
                        <div className="card-mana">{card.mana_cost}</div>
                      )}

                      {/* Card Name */}
                      <h3 className="card-name">{card.name}</h3>

                      {/* Type Line */}
                      {card.type_line && (
                        <p className="card-type">{card.type_line}</p>
                      )}

                      {/* Set */}
                      {card.set_name && (
                        <p className="card-set">{card.set_name}</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
        
        {/* No results message */}
        {!loading && (!results || results.length === 0) && !error && (
          <div className="results">
            <div className="no-results">
              Nessuna carta trovata per questa query.
            </div>
          </div>
        )}

        {/* Pagination Info - BOTTOM */}
        {pagination.totalCards > 0 && !loading && (
          <PaginationControls showButtons={true} />
        )}
      </div>
    </div>
  );
}

export default App;
