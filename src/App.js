import './App.css';
import FbxToGlbConverter from './components/FbxToGlbConverter';
import LoadDirectScene from './components/LoadDirectScene';
import SceneandOcculusionCulling from './components/SceneandOcculusionCulling';
import SceneLoader from './components/SceneLoader';

function App() {
  return (
    <div >
      <FbxToGlbConverter/>
      {/* <SceneLoader/> */}
      {/* <LoadDirectScene/> */}
      <SceneandOcculusionCulling/>
      
  
    
    </div>
  );
}

export default App;
