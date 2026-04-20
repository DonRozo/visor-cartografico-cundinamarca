import React, { useEffect, useState } from 'react';
import MapComponent from './features/map/MapComponent';
import Catalog from './features/catalog/Catalog';
import { fetchCatalogItems } from './services/arcgisService';
import { CatalogData, LayerTrigger } from './types';

const App: React.FC = () => {
    const [catalogData, setCatalogData] = useState<CatalogData>({ featureServices: [], gdbIdLookup: new Map() });
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [hasError, setHasError] = useState<boolean>(false);
    const [layerTrigger, setLayerTrigger] = useState<LayerTrigger | null>(null);

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

    const handleAddLayer = (item: any) => {
        setLayerTrigger({ item, timestamp: Date.now() });
    };

    return (
        <>
            <div id="header-bar">
                <div className="header-left">
                    <img 
                        src="https://cundinamarca-map.maps.arcgis.com/sharing/rest/content/items/b3f30beac0a949da80defac0672b4f54/data" 
                        alt="Logo Gobernación" 
                        className="logo" 
                    />
                    <h1>Cartografía de Cundinamarca</h1>
                </div>
                <div id="search-widget-container"></div>
            </div>

            <Catalog 
                data={catalogData} 
                isLoading={isLoading}
                hasError={hasError}
                onAddLayerToMap={handleAddLayer} 
            />

            <MapComponent layerTrigger={layerTrigger} />
        </>
    );
};

export default App;