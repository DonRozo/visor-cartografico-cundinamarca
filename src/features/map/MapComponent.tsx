import React, { useEffect, useRef } from 'react';
import { initializeMap, addLayerToMap } from './mapLogic';
import { LayerTrigger } from '../../types';
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";

interface MapComponentProps {
    layerTrigger: LayerTrigger | null;
}

// Contenedor de React para el mapa.
const MapComponent: React.FC<MapComponentProps> = ({ layerTrigger }) => {
    const mapDiv = useRef<HTMLDivElement>(null);
    const mapRef = useRef<Map | null>(null);
    const viewRef = useRef<MapView | null>(null);

    useEffect(() => {
        if (mapDiv.current && !mapRef.current) {
            const { map, view } = initializeMap(mapDiv.current);
            mapRef.current = map;
            viewRef.current = view;
        }
        
        return () => {
            if (viewRef.current) {
                viewRef.current.destroy();
                viewRef.current = null;
                mapRef.current = null;
            }
        };
    }, []);

    // Se ejecuta cada vez que cambia el layerTrigger (incluyendo el timestamp)
    useEffect(() => {
        if (layerTrigger && mapRef.current && viewRef.current) {
            addLayerToMap(mapRef.current, viewRef.current, layerTrigger.item);
        }
    }, [layerTrigger]);

    return <div id="viewDiv" ref={mapDiv}></div>;
};

export default MapComponent;