import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

function MultipleSelector({ 
  options = [], 
  onChange,
  placeholder = "Sélectionnez des options..."
}) {
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
        role="combobox"
        aria-controls="options-list"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="relative flex items-center flex-wrap w-full min-h-[2.75rem] border border-base-300 rounded-lg bg-base-100 text-base-content px-2 pr-8 py-1 cursor-pointer focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        onClick={() => setIsOpen(!isOpen)}
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
                  className="inline-flex justify-center items-center size-5 rounded-full text-base-content bg-base-200 hover:bg-base-300 focus:outline-none focus:ring-2 focus:ring-base-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOptionClick(item);
                  }}
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
          <svg className="size-3.5 text-base-content/70" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m7 15 5 5 5-5"/>
            <path d="m7 9 5-5 5 5"/>
          </svg>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full max-h-72 p-1 mt-2 space-y-0.5 bg-base-100 border border-base-300 rounded-lg overflow-hidden overflow-y-auto shadow-lg">
          {options.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <div
                key={option}
                role="option"
                tabIndex={0}
                aria-selected={isSelected}
                className={`py-2 px-2 w-full text-sm cursor-pointer hover:bg-base-200 rounded-lg focus:outline-none ${
                  isSelected ? 'bg-base-200' : ''
                }`}
                onClick={() => handleOptionClick(option)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleOptionClick(option);
                  }
                }}
              >
                <div className="flex items-center">
                  <div>
                    <div className={`text-sm ${isSelected ? 'font-bold' : 'font-normal'} text-base-content`}>{option}</div>
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

MultipleSelector.propTypes = {
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func,
  placeholder: PropTypes.string
};

export default MultipleSelector;