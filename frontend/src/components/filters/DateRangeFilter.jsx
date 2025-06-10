import React from 'react';
import PropTypes from 'prop-types';

function DateRangeFilter({ 
  value = { start: '', end: '' }, 
  onChange, 
  label = "Plage de dates",
  placeholder = { start: "Date début", end: "Date fin" }
}) {
  const handleStartChange = (e) => {
    onChange({
      ...value,
      start: e.target.value
    });
  };

  const handleEndChange = (e) => {
    onChange({
      ...value,
      end: e.target.value
    });
  };

  const clearDates = () => {
    onChange({ start: '', end: '' });
  };

  return (
    <div className="space-y-2">
      {label && <label className="label-text font-medium">{label}</label>}
      
      <div className="flex gap-2 items-center">
        <div className="flex-1">
          <input
            type="date"
            className="input input-bordered input-sm w-full"
            value={value.start || ''}
            onChange={handleStartChange}
            placeholder={placeholder.start}
          />
        </div>
        
        <span className="text-sm text-base-content/50">à</span>
        
        <div className="flex-1">
          <input
            type="date"
            className="input input-bordered input-sm w-full"
            value={value.end || ''}
            onChange={handleEndChange}
            placeholder={placeholder.end}
            min={value.start || undefined}
          />
        </div>
        
        {(value.start || value.end) && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={clearDates}
            title="Effacer les dates"
          >
            ×
          </button>
        )}
      </div>
      
      {value.start && value.end && (
        <div className="text-xs text-base-content/60">
          Du {new Date(value.start).toLocaleDateString('fr-FR')} au {new Date(value.end).toLocaleDateString('fr-FR')}
        </div>
      )}
    </div>
  );
}

DateRangeFilter.propTypes = {
  value: PropTypes.shape({
    start: PropTypes.string,
    end: PropTypes.string
  }),
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  placeholder: PropTypes.shape({
    start: PropTypes.string,
    end: PropTypes.string
  })
};

export default DateRangeFilter; 