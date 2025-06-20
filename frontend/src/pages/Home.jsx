import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Page from "../components/global/Page";
import { Button } from '../components/ui';
import { 
  FiDatabase, 
  FiFileText, 
  FiSettings, 
  FiUsers, 
  FiArrowRight,
  FiCheck,
  FiTrendingUp,
  FiBarChart,
  FiShield
} from 'react-icons/fi';

function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <Page>
      <div className="min-h-screen">
        {/* Section Héro */}
        <div className="hero min-h-[70vh] bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10 rounded-3xl mx-4 mt-8 shadow-lg">
          <div className="hero-content text-center max-w-4xl px-6 py-12">
            <div className="animate-fade-in">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-6">
                Gestionnaire de Projets Cochin
              </h1>
                             <p className="text-xl text-base-content/80 mb-8 max-w-2xl mx-auto leading-relaxed">
                 Un outil simple pour organiser vos projets et suivre vos devis. 
                 Interface personnalisable selon vos besoins.
               </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                {!isAuthenticated ? (
                  <>
                    <Link to="/login">
                      <Button 
                        variant="primary" 
                        size="lg"
                        className="btn-lg shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        <FiArrowRight className="mr-2" />
                        Se connecter
                      </Button>
                    </Link>
                    <button 
                      onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
                      className="btn btn-ghost btn-lg"
                    >
                      Découvrir les fonctionnalités
                    </button>
                  </>
                ) : (
                  <Link to="/dashboard">
                    <Button 
                      variant="primary" 
                      size="lg"
                      className="btn-lg shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      <FiBarChart className="mr-2" />
                      Accéder au tableau de bord
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section Fonctionnalités */}
        <div id="features" className="py-20 bg-base-100">
          <div className="container mx-auto px-4">
                         <div className="text-center mb-16">
               <h2 className="text-4xl font-bold text-base-content mb-4">
                 Fonctionnalités disponibles
               </h2>
               <p className="text-lg text-base-content/70 max-w-2xl mx-auto">
                 Ce que vous pouvez faire avec cet outil
               </p>
             </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                             {/* Gestion de Projets */}
               <div className="card home-feature-card bg-base-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="card-body text-center">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <FiFileText className="text-3xl text-primary" />
                  </div>
                  <h3 className="card-title justify-center text-xl mb-3">Gestion de Projets</h3>
                  <p className="text-base-content/70">
                    Indexez et archivez vos projets avec une interface intuitive. 
                    Organisez vos données de manière structurée et accessible.
                  </p>
                </div>
              </div>

              {/* Tableau de Bord */}
              <div className="card bg-base-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="card-body text-center">
                  <div className="mx-auto w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mb-4">
                    <FiBarChart className="text-3xl text-secondary" />
                  </div>
                  <h3 className="card-title justify-center text-xl mb-3">Tableau de Bord</h3>
                  <p className="text-base-content/70">
                    Visualisez vos données avec des graphiques interactifs et des métriques en temps réel. 
                    Suivez l'avancement de vos projets d'un coup d'œil.
                  </p>
                </div>
              </div>

              {/* Suivi des Devis */}
              <div className="card bg-base-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="card-body text-center">
                  <div className="mx-auto w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-4">
                    <FiTrendingUp className="text-3xl text-accent" />
                  </div>
                  <h3 className="card-title justify-center text-xl mb-3">Suivi des Devis</h3>
                  <p className="text-base-content/70">
                    Gérez l'évolution de vos devis avec un système de suivi complet. 
                    Analysez les tendances et optimisez vos processus.
                  </p>
                </div>
              </div>

              {/* Personnalisation */}
              <div className="card bg-base-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="card-body text-center">
                  <div className="mx-auto w-16 h-16 bg-info/10 rounded-full flex items-center justify-center mb-4">
                    <FiSettings className="text-3xl text-info" />
                  </div>
                  <h3 className="card-title justify-center text-xl mb-3">Personnalisation</h3>
                  <p className="text-base-content/70">
                    Adaptez l'interface à vos besoins avec des paramètres flexibles. 
                    Configurez les champs et les vues selon vos préférences.
                  </p>
                </div>
              </div>

                             {/* Gestion des Utilisateurs */}
               <div className="card bg-base-200 shadow-lg hover:shadow-xl transition-all duration-300">
                 <div className="card-body text-center">
                   <div className="mx-auto w-16 h-16 bg-info/10 rounded-full flex items-center justify-center mb-4">
                     <FiUsers className="text-3xl text-info" />
                   </div>
                   <h3 className="card-title justify-center text-xl mb-3">Multi-utilisateurs</h3>
                   <p className="text-base-content/70">
                     Collaboration en équipe avec gestion des droits et des rôles. 
                     Partagez vos projets en toute sécurité.
                   </p>
                 </div>
               </div>

               {/* Sauvegarde */}
               <div className="card bg-base-200 shadow-lg hover:shadow-xl transition-all duration-300">
                 <div className="card-body text-center">
                   <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
                     <FiShield className="text-3xl text-success" />
                   </div>
                   <h3 className="card-title justify-center text-xl mb-3">Sécurité & Backup</h3>
                   <p className="text-base-content/70">
                     Vos données sont protégées avec un système de sauvegarde automatique 
                     et des fonctionnalités de sécurité avancées.
                   </p>
                 </div>
               </div>
            </div>
          </div>
        </div>

        {/* Section Demo/CTA */}
        <div className="py-20 bg-gradient-to-br from-base-200 to-base-300">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-4xl mx-auto">
                             <h2 className="text-4xl font-bold text-base-content mb-6">
                 À propos de cet outil
               </h2>
               <p className="text-lg text-base-content/70 mb-12 max-w-2xl mx-auto">
                 Un gestionnaire de projets développé pour simplifier le suivi 
                 de vos activités et l'organisation de vos données.
               </p>
              
              <div className="grid md:grid-cols-3 gap-8 mb-12">
                <div className="stat">
                  <div className="stat-figure text-primary">
                    <FiFileText className="text-3xl" />
                  </div>
                  <div className="stat-title">Projets gérés</div>
                  <div className="stat-value text-primary">∞</div>
                  <div className="stat-desc">Capacité illimitée</div>
                </div>

                <div className="stat">
                  <div className="stat-figure text-secondary">
                    <FiBarChart className="text-3xl" />
                  </div>
                  <div className="stat-title">Tableaux de bord</div>
                  <div className="stat-value text-secondary">100%</div>
                  <div className="stat-desc">Personnalisables</div>
                </div>

                                 <div className="stat">
                   <div className="stat-figure text-accent">
                     <FiShield className="text-3xl" />
                   </div>
                   <div className="stat-title">Sécurité</div>
                   <div className="stat-value text-accent">24/7</div>
                   <div className="stat-desc">Surveillance continue</div>
                 </div>
              </div>

                             {!isAuthenticated && (
                 <Link to="/login">
                   <Button 
                     variant="primary" 
                     size="lg"
                     className="btn-lg shadow-lg hover:shadow-xl transition-all duration-300"
                   >
                     <FiArrowRight className="mr-2" />
                     Se connecter
                   </Button>
                 </Link>
               )}
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}

export default Home;