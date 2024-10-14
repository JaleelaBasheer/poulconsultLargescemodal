import './App.css';
import LoadFiles from './babylonComponent/LoadFiles';
import RemoveGeometry from './babylonComponent/RemoveGeometry';
import BabylonComponent from './components/babylonComponent';
import BabylonSceneLoader from './babylonComponent/BabylonSceneLoader';
import FbxToGlbConverter from './components/FbxToGlbConverter';
import GlbLoaderWithoutoctree from './components/GlbLoaderWithoutoctree';
import LoadDirectScene from './components/LoadDirectScene';
import Reduce from './components/Reduce';
import FBXViewer from './components/Rohith';
import SceneandOcculusionCulling from './components/SceneandOcculusionCulling';
import SceneLoader from './components/SceneLoader';

function App() {
  return (
    <div >
      {/* <FbxToGlbConverter/> */}
      {/* <SceneLoader/> */}
      {/* <LoadDirectScene/> */}
      {/* <SceneandOcculusionCulling/> */}
      {/* <GlbLoaderWithoutoctree/> */}
      {/* <BabylonComponent/> */}
      {/* <FBXViewer/> */}
      {/* <Reduce/> */}
      <LoadFiles/>
      <BabylonSceneLoader/>
      
  
    
    </div>
  );
}

export default App;
