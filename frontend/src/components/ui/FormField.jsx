import React from 'react';
import PropTypes from 'prop-types';

/**
 * Composant FormField réutilisable
 * 
 * @param {string} id - ID unique du champ
 * @param {string} name - Nom du champ pour les formulaires
 * @param {string} label - Libellé du champ
 * @param {string} type - Type d'input (text, password, email, etc.)
 * @param {string} placeholder - Texte d'exemple
 * @param {string} value - Valeur actuelle du champ
 * @param {function} onChange - Gestionnaire de changement de valeur
 * @param {boolean} required - Si le champ est obligatoire
 * @param {string} error - Message d'erreur à afficher
 * @param {string} helperText - Texte d'aide sous le champ
 */
function FormField({
  id,
  name,
  label,
  type = 'text',
  placeholder = '',
  value,
  onChange,
  required = false,
  error = '',
  helperText = '',
  autoComplete = '',
  ...props
}) {
  return (
    <div className="form-control w-full">
      {label && (
        <label htmlFor={id} className="label">
          <span className="label-text">{label}</span>
          {required && <span className="text-error ml-1">*</span>}
        </label>
      )}
      
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
        className={`input input-bordered w-full ${error ? 'input-error' : ''}`}
        {...props}
      />
      
      {(error || helperText) && (
        <label className="label">
          {error ? (
            <span className="label-text-alt text-error">{error}</span>
          ) : (
            <span className="label-text-alt">{helperText}</span>
          )}
        </label>
      )}
    </div>
  );
}

FormField.propTypes = {
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  type: PropTypes.string,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  required: PropTypes.bool,
  error: PropTypes.string,
  helperText: PropTypes.string,
  autoComplete: PropTypes.string
};

export default FormField;