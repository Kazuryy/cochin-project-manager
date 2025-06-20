# Système de Filtres Avancés - Documentation

Un système modulaire et complet de filtres avancés pour le dashboard de gestion de projets.

## 🚀 Fonctionnalités

### Types de filtres supportés
- **Texte** : Recherche textuelle avec opérateurs
- **Plage de dates** : Sélection de périodes
- **Plage numérique** : Montants, budgets avec support des devises
- **Booléens** : Oui/Non/Tous
- **Sélection multiple** : Choix parmi plusieurs options
- **Comparaison** : Opérateurs avancés (égal, contient, etc.)

### Fonctionnalités avancées
- **Tri multiple** : Tri par plusieurs champs avec priorités
- **Gestion des colonnes** : Affichage/masquage dynamique
- **Presets** : Sauvegarde et chargement de configurations
- **Persistance** : Sauvegarde locale (localStorage)

## 📁 Structure des fichiers

```
frontend/src/
├── hooks/
│   └── useAdvancedFilters.js      # Hook principal
├── components/filters/
│   ├── index.js                   # Exports groupés
│   ├── AdvancedFilterPanel.jsx    # Panneau principal
│   ├── ColumnSelector.jsx         # Sélecteur de colonnes
│   ├── PresetManager.jsx          # Gestion des presets
│   ├── SortManager.jsx            # Gestion du tri
│   ├── DateRangeFilter.jsx        # Filtre de dates
│   ├── NumberRangeFilter.jsx      # Filtre numérique
│   ├── BooleanFilter.jsx          # Filtre booléen
│   ├── ComparisonFilter.jsx       # Filtre de comparaison
│   ├── MultiSelector.jsx          # Sélection multiple
│   ├── FilterDemo.jsx             # Composant de démonstration
│   └── README.md                  # Cette documentation
```

## 🔧 Utilisation

### Import du hook principal

```javascript
import { useAdvancedFilters } from '../hooks/useAdvancedFilters';

const {
  filters,
  sorting,
  visibleColumns,
  presets,
  filteredData,
  addFilter,
  removeFilter,
  updateFilter,
  clearFilters,
  // ... autres méthodes
} = useAdvancedFilters(data, defaultColumns);
```

### Utilisation du panneau de filtres

```javascript
import { AdvancedFilterPanel } from '../components/filters';

<AdvancedFilterPanel
  filters={filters}
  availableFields={availableFields}
  onAddFilter={addFilter}
  onUpdateFilter={updateFilter}
  onRemoveFilter={removeFilter}
  onClearFilters={clearFilters}
  onSavePreset={savePreset}
  getFieldOptions={getFieldOptions}
/>
```

## 📝 Configuration des champs

### Définition des champs disponibles

```javascript
const availableFields = [
  { value: 'nom_projet', label: 'Nom du projet' },
  { value: 'date_creation', label: 'Date de création' },
  { value: 'budget', label: 'Budget' },
  { value: 'termine', label: 'Terminé' },
  // ...
];
```

### Définition des colonnes

```javascript
const availableColumns = [
  { 
    id: 'project_name', 
    label: 'Nom du projet', 
    description: 'Nom principal du projet' 
  },
  { 
    id: 'contact_principal', 
    label: 'Contact principal', 
    description: 'Responsable du projet' 
  },
  // ...
];
```

## 🔍 Types de filtres

### 1. Filtre de texte
```javascript
{
  type: FILTER_TYPES.TEXT,
  field: 'nom_projet',
  operator: COMPARISON_OPERATORS.CONTAINS,
  value: 'recherche'
}
```

### 2. Filtre de plage de dates
```javascript
{
  type: FILTER_TYPES.DATE_RANGE,
  field: 'date_creation',
  value: { start: '2024-01-01', end: '2024-12-31' }
}
```

### 3. Filtre numérique
```javascript
{
  type: FILTER_TYPES.NUMBER_RANGE,
  field: 'budget',
  value: { min: 1000, max: 50000 }
}
```

### 4. Filtre booléen
```javascript
{
  type: FILTER_TYPES.BOOLEAN,
  field: 'termine',
  value: true // true, false, ou null pour "tous"
}
```

### 5. Sélection multiple
```javascript
{
  type: FILTER_TYPES.SELECT_MULTIPLE,
  field: 'type_projet',
  value: ['Type 1', 'Type 2']
}
```

## 🎯 Opérateurs de comparaison

```javascript
COMPARISON_OPERATORS = {
  EQUALS: 'equals',
  NOT_EQUALS: 'not_equals',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'not_contains',
  STARTS_WITH: 'starts_with',
  ENDS_WITH: 'ends_with',
  GREATER_THAN: 'greater_than',
  LESS_THAN: 'less_than',
  GREATER_EQUAL: 'greater_equal',
  LESS_EQUAL: 'less_equal'
}
```

## 🔄 Gestion du tri

### Tri simple
```javascript
addSort('nom_projet', 'asc'); // ou 'desc'
```

### Tri multiple avec priorités
```javascript
addSort('priorite', 'desc');   // Priorité 0 (plus important)
addSort('nom_projet', 'asc');  // Priorité 1
addSort('date_creation', 'desc'); // Priorité 2
```

## 💾 Gestion des presets

### Sauvegarder un preset
```javascript
const preset = savePreset('Mon filtre personnalisé', 'Description optionnelle');
```

### Charger un preset
```javascript
loadPreset(preset);
```

### Structure d'un preset
```javascript
{
  id: 'unique_id',
  name: 'Nom du preset',
  description: 'Description',
  filters: [...],
  sorting: [...],
  visibleColumns: [...],
  createdAt: '2024-01-01T00:00:00.000Z'
}
```

## 🎨 Gestion des colonnes

### Définir les colonnes visibles
```javascript
setVisibleColumns(['project_name', 'contact_principal']);
```

### Composant de sélection
```javascript
<ColumnSelector
  availableColumns={availableColumns}
  visibleColumns={visibleColumns}
  onChange={setVisibleColumns}
/>
```

## 🧪 Tests et développement

### Composant de démonstration
Un composant `FilterDemo` est disponible pour tester tous les types de filtres :

```javascript
import FilterDemo from '../components/filters/FilterDemo';

// Dans votre route de développement
<FilterDemo />
```

## 🔗 Intégration avec les données

### Fonction getFieldOptions
```javascript
const getFieldOptions = (field) => {
  switch (field) {
    case 'type_projet':
      return projectTypes;
    case 'equipe':
      return teams;
    case 'statut':
      return statuses;
    default:
      return [];
  }
};
```

### Extraction des valeurs de champs
Le hook utilise une fonction `getFieldValue` qui supporte :
- Champs directs de l'objet
- Champs dans un tableau `values` (pour les structures complexes)
- Multiples noms de champs possibles

## 📱 Interface utilisateur

### Themes DaisyUI
Le système utilise les classes DaisyUI pour un design cohérent :
- `btn`, `btn-outline`, `btn-primary`
- `input`, `select`, `textarea`
- `card`, `badge`, `alert`
- `modal`, `dropdown`, `tabs`

### Responsive
Tous les composants sont responsive et s'adaptent aux écrans mobiles.

## 🚨 Bonnes pratiques

### Performance
- Les filtres sont mémorisés avec `useMemo`
- Les fonctions de callback utilisent `useCallback`
- Éviter de recréer les objets de configuration à chaque render

### Accessibilité
- Labels appropriés sur tous les champs
- Navigation au clavier
- États focus visibles
- Messages d'erreur clairs

### Maintenance
- Types PropTypes définis pour tous les composants
- Documentation inline des fonctions complexes
- Noms de variables explicites
- Separation des responsabilités

## 🔄 Mise à jour

Pour ajouter un nouveau type de filtre :

1. Ajouter le type dans `FILTER_TYPES`
2. Créer le composant de filtre correspondant
3. Ajouter la logique dans `applyFilters` du hook
4. Intégrer dans `AdvancedFilterPanel`
5. Mettre à jour la documentation

---

**Auteur :** Système de filtres avancés modulaire  
**Version :** 1.0  
**Date :** Décembre 2024 