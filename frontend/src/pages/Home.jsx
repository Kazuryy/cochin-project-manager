import Page from "../components/global/Page";

function Home() {
  return (
    <Page>
      <div className='pt-6'>
        <div className="container mx mt-4">
          <h1 className="text-4xl font-bold text-center">Interface de gestion de projets</h1>
          <p className="text-center mt-4 pr-80 pl-80">Ce projet est un outil de gestion de projet qui a pour but d'indexer et d'archiver vos différents projets avec un tableau de bord permettant de visualiser leurs caractéristiques ainsi que l'avancement des devis. Il est possible de customiser la plupart des paramètres.</p>
          <div className="flex justify-center gap-4 mt-8">
          </div>
        </div>
      </div>
    </Page>
  );
}

export default Home;