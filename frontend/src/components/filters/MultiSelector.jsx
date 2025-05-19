import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

function MultipleSelector({ options = [], onChange }) {
  const [selected, setSelected] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const handleClickOutside = (event) => {
    if (containerRef.current && !containerRef.current.contains(event.target)) {
      setIsOpen(false);
    }
  };

  const handleOptionClick = (option) => {
    const newSelected = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option];
    setSelected(newSelected);
    onChange?.(newSelected);
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        className="border rounded px-3 py-2 cursor-pointer min-h-[44px] flex flex-wrap gap-2 items-center bg-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selected.length === 0 ? (
          <span className="text-gray-400">Sélectionnez des options...</span>
        ) : (
          selected.map((item) => (
            <span
              key={item}
              className="bg-primary/10 text-primary px-2 py-1 rounded flex items-center gap-1 text-sm"
            >
              {item}
              <button
                type="button"
                className="text-xs hover:text-error"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOptionClick(item);
                }}
              >
                &times;
              </button>
            </span>
          ))
        )}
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
          {options.map((option) => (
            <div
              key={option}
              role="option"
              tabIndex={0}
              aria-selected={selected.includes(option)}
              className={`px-3 py-2 hover:bg-primary/10 ${
                selected.includes(option) ? 'bg-primary/5 font-semibold' : ''
              }`}
              onClick={() => handleOptionClick(option)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleOptionClick(option);
                }
              }}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

MultipleSelector.propTypes = {
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func
};

export default MultipleSelector;