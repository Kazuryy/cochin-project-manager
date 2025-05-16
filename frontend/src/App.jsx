import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/global/Navbar';
import Home from './pages/Home';
import './App.css'

function App() {
  return (
    <Router>
      <Navbar />
      <div className="container mx-auto mt-4">
        <Routes>
          <Route path='/' element={<Home />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
