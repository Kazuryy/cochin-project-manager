import Page from "../components/global/Page";

function Home() {
  return (
    <Page>
      <div className='pt-6'>
        <div className="container mx mt-4">
          <h1 className="text-4xl font-bold text-center">Gestion de projets chez Cochin</h1>
          <p className="text-center mt-4">Un projet en cours</p>
          <div className="flex justify-center gap-4 mt-8">
          </div>
        </div>
      </div>
    </Page>
  );
}

export default Home;