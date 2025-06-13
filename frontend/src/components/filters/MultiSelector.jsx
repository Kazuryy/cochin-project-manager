import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

function MultiSelector({ 
  options = [], 
  onChange,
  placeholder = "Sélectionnez des options...",
  selectedValues = []
}) {
  // État local pour les valeurs sélectionnées (controlled par selectedValues prop)
  const [selected, setSelected] = useState(selectedValues);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  // Synchronisation avec les props uniquement si nécessaire
  useEffect(() => {
    if (JSON.stringify(selectedValues) !== JSON.stringify(selected)) {
      setSelected(selectedValues);
    }
  }, [selectedValues, selected]);

  // Validation et normalisation des options
  const validOptions = useMemo(() => {
    return Array.isArray(options) ? options.filter(option => option != null) : [];
  }, [options]);

  // Handler optimisé pour les clics extérieurs
  const handleClickOutside = useCallback((event) => {
    if (containerRef.current && !containerRef.current.contains(event.target)) {
      setIsOpen(false);
      setFocusedIndex(-1);
    }
  }, []);

  // Handler optimisé pour la sélection d'options
  const handleOptionClick = useCallback((option) => {
    if (!option) return;
    
    const newSelected = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option];
    
    setSelected(newSelected);
    onChange?.(newSelected);
  }, [selected, onChange]);

  // Handler optimisé pour l'ouverture/fermeture du dropdown
  const toggleDropdown = useCallback(() => {
    setIsOpen(prev => !prev);
    setFocusedIndex(-1);
  }, []);

  // Gestion améliorée du clavier pour l'accessibilité
  const handleKeyDown = useCallback((event) => {
    if (!isOpen) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        setIsOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        setFocusedIndex(-1);
        containerRef.current?.focus();
        break;
      
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => 
          prev < validOptions.length - 1 ? prev + 1 : 0
        );
        break;
      
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => 
          prev > 0 ? prev - 1 : validOptions.length - 1
        );
        break;
      
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < validOptions.length) {
          handleOptionClick(validOptions[focusedIndex]);
        }
        break;
    }
  }, [isOpen, focusedIndex, validOptions, handleOptionClick]);

  // Handler pour le retrait d'un élément sélectionné
  const handleRemoveItem = useCallback((item, event) => {
    event.stopPropagation();
    handleOptionClick(item);
  }, [handleOptionClick]);

  // Effet pour gérer les événements globaux
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  // Effet pour gérer le scroll vers l'élément focusé
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const focusedElement = listRef.current.children[focusedIndex];
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isOpen, focusedIndex]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        role="button"
        aria-controls="options-list"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={placeholder}
        tabIndex={0}
        className="relative flex items-center flex-wrap w-full min-h-[2.75rem] border border-base-300 rounded-lg bg-base-100 text-base-content px-2 pr-8 py-1 cursor-pointer focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
      >
        {selected.length === 0 ? (
          <span className="text-base-content/50 py-1.5 px-1">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-1 w-full py-0.5">
            {selected.map((item) => (
              <div 
                key={item}
                className="flex items-center bg-base-100 border border-base-300 rounded-full p-1 m-0.5"
              >
                <span className="text-sm text-base-content whitespace-nowrap px-1.5">
                  {item}
                </span>
                <button
                  type="button"
                  aria-label={`Retirer ${item}`}
                  className="inline-flex justify-center items-center size-5 rounded-full text-base-content bg-base-200 hover:bg-base-300 focus:outline-none focus:ring-2 focus:ring-base-300"
                  onClick={(e) => handleRemoveItem(item, e)}
                >
                  <svg className="size-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18"/>
                    <path d="m6 6 12 12"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="absolute top-1/2 right-3 -translate-y-1/2 pointer-events-none">
          <svg 
            className={`size-3.5 text-base-content/70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
            xmlns="http://www.w3.org/2000/svg" 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="m7 15 5 5 5-5"/>
            <path d="m7 9 5-5 5 5"/>
          </svg>
        </div>
      </div>

      {isOpen && validOptions.length > 0 && (
        <div 
          id="options-list"
          ref={listRef}
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-50 w-full max-h-72 p-1 mt-2 space-y-0.5 bg-base-100 border border-base-300 rounded-lg overflow-hidden overflow-y-auto shadow-lg"
        >
          {validOptions.map((option, index) => {
            const isSelected = selected.includes(option);
            const isFocused = index === focusedIndex;
            
            return (
              <div
                key={option}
                role="option"
                tabIndex={-1}
                aria-selected={isSelected}
                className={`py-2 px-2 w-full text-sm cursor-pointer rounded-lg focus:outline-none transition-colors duration-150 ${
                  isFocused ? 'bg-primary/10 border border-primary/20' : 'hover:bg-base-200'
                } ${isSelected ? 'bg-base-200' : ''}`}
                onClick={() => handleOptionClick(option)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOptionClick(option);
                  }
                }}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                <div className="flex items-center">
                  <div>
                    <div className={`text-sm ${isSelected ? 'font-bold' : 'font-normal'} text-base-content`}>
                      {option}
                    </div>
                  </div>
                  <div className="ml-auto">
                    {isSelected && (
                      <svg className="size-4 text-primary" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022Z"/>
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

MultiSelector.propTypes = {
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  selectedValues: PropTypes.arrayOf(PropTypes.string)
};

export default MultiSelector;