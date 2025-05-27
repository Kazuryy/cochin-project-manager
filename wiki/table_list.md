Voici la retranscription textuelle du schéma de base de données à partir de l'image que tu as fournie :

---

### **Table : Choix**

| Colonne                            | Type         | Remarques                   |
| ---------------------------------- | ------------ | --------------------------- |
| sous\_type\_prestation             | VARCHAR(200) | BULK;Single-cell;Spatialite |
| reference\_espace                  | VARCHAR(500) | humains;cours;rocheart      |
| qualite                            | VARCHAR(500) | bonne;moyenne;mauvaise      |
| formation\_sous\_type\_options     | VARCHAR(500) | R;Autres                    |
| collaboration\_sous\_type\_options | VARCHAR(500) | Plateforme;Contact          |

---

### **Table : PrestationDetails**

| Colonne                | Type                                | Remarques                    |
| ---------------------- | ----------------------------------- | ---------------------------- |
| prestation\_detail\_id | INT, PK, AI                         |                              |
| projet\_id             | INT, FK → Projet.projet\_id, UNIQUE |                              |
| sous\_type             | VARCHAR(200)                        | BULK;SINGLE CELL;SPATIALITE  |
| n\_samples             | INT, NULL                           |                              |
| reference\_espace      | VARCHAR(500)                        | FK → Choix.reference\_espace |
| stockage\_donnee       | VARCHAR(200)                        | /mnt/data/server\_stockage   |
| qualite                | VARCHAR(500)                        | FK → Choix.qualite           |

---

### **Table : FormationDetails**

| Colonne                | Type                                | Remarques                                 |
| ---------------------- | ----------------------------------- | ----------------------------------------- |
| formation\_details\_id | INT, PK, AI                         |                                           |
| projet\_id             | INT, FK → Projet.projet\_id, UNIQUE |                                           |
| sous\_type             | VARCHAR(500)                        | FK → Choix.formation\_sous\_type\_options |
| materiel\_formation    | TEXT, NULL                          | e.g. pdf                                  |

---

### **Table : CollaborationDetails**

| Colonne                   | Type                                | Remarques                                     |
| ------------------------- | ----------------------------------- | --------------------------------------------- |
| collaboration\_detail\_id | INT, PK, AI                         |                                               |
| projet\_id                | INT, FK → Projet.projet\_id, UNIQUE |                                               |
| sous\_type                | VARCHAR(500)                        | FK → Choix.collaboration\_sous\_type\_options |
| contact\_collaboration    | VARCHAR(200)                        | e.g. Jean Michel                              |

---

### **Table : Projet**

| Colonne                | Type                           | Remarques                   |
| ---------------------- | ------------------------------ | --------------------------- |
| projet\_id             | INT, PK, AI                    |                             |
| numero\_projet         | VARCHAR, UNIQUE                | e.g. 1300-19-384            |
| nom\_projet            | VARCHAR                        | e.g. Recherche de mutations |
| contact\_principal\_id | INT, FK → Contacts.contact\_id |                             |
| equipe                 | VARCHAR                        | e.g. GenomiC                |
| description            | TEXT                           | e.g. Trouver des mutations  |
| type\_projet           | INT                            | FK → TableNames.type\_id    |

---

### **Table : DevisParProjet**

| Colonne     | Type | Remarques              |
| ----------- | ---- | ---------------------- |
| projet\_id  | INT  | FK → Projet.projet\_id |
| devis\_link | INT  |                        |

---

### **Table : Devis**

| Colonne           | Type                | Remarques                |
| ----------------- | ------------------- | ------------------------ |
| devis\_id         | INT, PK, AI         |                          |
| numero\_devis     | VARCHAR(50), UNIQUE |                          |
| montant           | DECIMAL(10,2)       |                          |
| etat              | BOOLEAN             |                          |
| date\_debut       | DATE, NULL          | Renseigné si etat = True |
| date\_rendu       | DATE, NULL          | Renseigné si etat = True |
| agent\_plateforme | VARCHAR(100), NULL  | Renseigné si etat = True |

---

### **Table : Contacts**

| Colonne     | Type         | Remarques                                                    |
| ----------- | ------------ | ------------------------------------------------------------ |
| contact\_id | INT, PK, AI  |                                                              |
| email       | VARCHAR(100) | e.g. [prenom.nom@example.com](mailto:prenom.nom@example.com) |
| nom         | VARCHAR(100) |                                                              |
| prenom      | VARCHAR(100) |                                                              |
| equipe      | VARCHAR(100) | e.g. GenomiC                                                 |

---

### **Table : TableNames**

| Colonne     | Type         | Remarques                  |
| ----------- | ------------ | -------------------------- |
| type\_id    | INT, PK, AI  |                            |
| nom         | VARCHAR(200) | e.g. Prestation, Formation |
| description | VARCHAR(500) | e.g. Fake pour discuter    |

---

Souhaites-tu également un script SQL pour créer ces tables ?
