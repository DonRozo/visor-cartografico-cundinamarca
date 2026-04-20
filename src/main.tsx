import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './styles/App.css';

// Importamos los estilos base de ArcGIS desde el paquete NPM
import "@arcgis/core/assets/esri/themes/light/main.css";

// [CORRECCIÓN] Se eliminó la envoltura de <React.StrictMode> 
// para evitar que los efectos de inicialización del mapa se disparen dos veces 
// en desarrollo, lo cual causaba la duplicación visual de los widgets de ArcGIS.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);