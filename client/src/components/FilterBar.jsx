import { useState, useEffect } from 'react';
import '../App.css';

const FORMATS = [
  { value: 'all', label: 'All Formats' },
  { value: 'standard', label: 'Standard' },
  { value: 'pioneer', label: 'Pioneer' },
  { value: 'modern', label: 'Modern' },
  { value: 'legacy', label: 'Legacy' },
  { value: 'vintage', label: 'Vintage' },
  { value: 'commander', label: 'Commander' },
  { value: 'pauper', label: 'Pauper' },
  { value: 'historic', label: 'Historic' },
  { value: 'explorer', label: 'Explorer' },
];

const ORDER_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'name', label: 'Name' },
  { value: 'cmc', label: 'CMC' },
  { value: 'released', label: 'Released' },
  { value: 'color', label: 'Color' },
  { value: 'set', label: 'Set' },
  { value: 'rarity', label: 'Rarity' },
  { value: 'power', label: 'Power' },
  { value: 'toughness', label: 'Toughness' },
  { value: 'usd', label: 'Price (USD)' },
];

const DIRECTION_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
];

export default function FilterBar({ onFiltersChange, filters }) {
  const [format, setFormat] = useState(filters?.format || 'all');
  const [order, setOrder] = useState(filters?.order || 'auto');
  const [direction, setDirection] = useState(filters?.direction || 'auto');

  useEffect(() => {
    setFormat(filters?.format || 'all');
    setOrder(filters?.order || 'auto');
    setDirection(filters?.direction || 'auto');
  }, [filters]);

  const handleFilterChange = (type, value) => {
    let newFormat = format;
    let newOrder = order;
    let newDirection = direction;

    if (type === 'format') {
      newFormat = value;
      setFormat(value);
    } else if (type === 'order') {
      newOrder = value;
      setOrder(value);
      // Se order è auto, resetta direction
      if (value === 'auto') {
        newDirection = 'auto';
        setDirection('auto');
      }
    } else if (type === 'direction') {
      newDirection = value;
      setDirection(value);
    }

    // Callback al parent
    onFiltersChange({
      format: newFormat,
      order: newOrder,
      direction: newDirection
    });
  };

  const handleReset = () => {
    setFormat('all');
    setOrder('auto');
    setDirection('auto');
    onFiltersChange({ format: 'all', order: 'auto', direction: 'auto' });
  };

  const hasActiveFilters = format !== 'all' || order !== 'auto';

  return (
    <div className="filter-bar">
      <div className="filter-bar-content">
        {/* Dropdown Format */}
        <div className="filter-group">
          <label className="filter-label">Format</label>
          <select
            value={format}
            onChange={(e) => handleFilterChange('format', e.target.value)}
            className="filter-select"
          >
            {FORMATS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* Dropdown Order */}
        <div className="filter-group">
          <label className="filter-label">Order By</label>
          <select
            value={order}
            onChange={(e) => handleFilterChange('order', e.target.value)}
            className="filter-select"
          >
            {ORDER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Dropdown Direction */}
        <div className="filter-group">
          <label className="filter-label">Direction</label>
          <select
            value={direction}
            onChange={(e) => handleFilterChange('direction', e.target.value)}
            className="filter-select"
            disabled={order === 'auto'}
          >
            {DIRECTION_OPTIONS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        {/* Reset Button */}
        {hasActiveFilters && (
          <div className="filter-reset">
            <button
              onClick={handleReset}
              className="filter-reset-button"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


