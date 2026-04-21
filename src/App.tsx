import React, { useEffect, useState } from 'react';
import MapComponent from './features/map/MapComponent';
import Catalog from './features/catalog/Catalog';
import { fetchCatalogItems } from './services/arcgisService';
import { CatalogData, LayerTrigger } from './types';

const App: React.FC = () => {
    // [LÓGICA INTACTA] Estados funcionales del catálogo y el mapa
    const [catalogData, setCatalogData] = useState<CatalogData>({ featureServices: [], gdbIdLookup: new Map() });
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [hasError, setHasError] = useState<boolean>(false);
    const [layerTrigger, setLayerTrigger] = useState<LayerTrigger | null>(null);

    // Carga inicial de los ítems del catálogo desde ArcGIS Online
    useEffect(() => {
        setIsLoading(true);
        fetchCatalogItems().then(response => {
            if (response.error || !response.data) {
                setHasError(true);
                setCatalogData({ featureServices: [], gdbIdLookup: new Map() });
            } else {
                setCatalogData(response.data);
                setHasError(false);
            }
            setIsLoading(false);
        });
    }, []);

    // Función que actualiza el trigger forzando al mapa a enfocar/añadir la capa
    const handleAddLayer = (item: any) => {
        setLayerTrigger({ item, timestamp: Date.now() });
    };

    // [ESTRUCTURA ACTUALIZADA] Layout preparado para el nuevo diseño institucional
    return (
        <div className="app-container">
            
            {/* 1. Franja superior institucional tipo GOV.CO */}
            <div className="gov-co-bar">
                <img 
                    src="https://estampillas.cundinamarca.gov.co/info/estampillas/media/bloque3.png" 
                    alt="Logo GOV.CO" 
                    className="gov-co-logo" 
                />
            </div>

            {/* 2. Segunda franja / Header blanco institucional */}
            <header id="header-bar" className="institutional-header">
                <div className="header-left">
                    <img 
                        src="https://cundinamarca-map.maps.arcgis.com/sharing/rest/content/items/69848936d99442548cea05577f2a1aeb/data" 
                        alt="Gobernación de Cundinamarca" 
                        className="logo logo-gov" 
                    />
                    <img 
                        src="https://cundinamarca-map.maps.arcgis.com/sharing/rest/content/items/ec7abedca4664cfe8fcd38c6e8603b2e/data" 
                        alt="IDEE / DIDEE" 
                        className="logo logo-idee" 
                    />
                    <h1 className="header-title">Visor Geográfico de Cundinamarca</h1>
                </div>
                
                {/* Contenedor oficial del widget Search nativo de ArcGIS */}
                <div id="search-widget-container" className="header-search"></div>
            </header>

            {/* 3. Área principal de contenido (Catálogo y Mapa) */}
            <main className="main-layout">
                
                {/* Panel lateral izquierdo (El componente Catalog renderiza su propio #sidebar) */}
                <Catalog 
                    data={catalogData} 
                    isLoading={isLoading}
                    hasError={hasError}
                    onAddLayerToMap={handleAddLayer} 
                />

                {/* Área envolvente del mapa interactivo */}
                <div className="map-wrapper">
                    {/* Componente que monta la vista real de ArcGIS */}
                    <MapComponent layerTrigger={layerTrigger} />
                    
                    {/* 4. Estructura preparada para controles flotantes a la derecha (Fase futura) */}
                    <div className="floating-controls-container">
                        {/* Aquí se montarán los botones de herramientas, leyenda, etc. */}
                    </div>
                </div>
                
            </main>
        </div>
    );
};

export default App;