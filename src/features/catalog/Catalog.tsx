import React, { useState, useMemo } from 'react';
import ItemCard from './ItemCard';
import ItemDetail from './ItemDetail';
import { CatalogData, ArcGISItem, LogicalDataset } from '../../types';

// Definición estricta de las props que recibe desde App.tsx
interface CatalogProps {
    data: CatalogData;
    isLoading: boolean;
    hasError: boolean;
    onAddLayerToMap: (item: ArcGISItem) => void;
}

// Función auxiliar nativa para normalizar texto: pasa a minúsculas y elimina tildes/diacríticos
const normalizeText = (text?: string): string => {
    if (!text) return "";
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

// Mantiene compatibilidad con respuestas legacy que solo incluyan Feature Services.
const mapLegacyItemToLogicalDataset = (item: ArcGISItem): LogicalDataset => ({
    baseId: item.id,
    title: item.title,
    thumbnail: item.thumbnail,
    snippet: item.snippet,
    description: item.description,
    featureService: item
});

// Orquestador del panel lateral con manejo de estados visuales y búsqueda avanzada
const Catalog: React.FC<CatalogProps> = ({ data, isLoading, hasError, onAddLayerToMap }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedDataset, setSelectedDataset] = useState<LogicalDataset | null>(null);

    // Si existen datasets lógicos los usamos; si no, conservamos la estructura legacy.
    const sourceDatasets = useMemo(() => {
        if (data.logicalDatasets && data.logicalDatasets.length > 0) {
            return data.logicalDatasets.filter(dataset => dataset.vectorTile || dataset.featureService);
        }
        return (data.featureServices || []).map(mapLegacyItemToLogicalDataset);
    }, [data.logicalDatasets, data.featureServices]);

    // Filtra dinámicamente controlando el ruido en términos cortos.
    const filteredDatasets = useMemo(() => {
        if (!searchTerm) return sourceDatasets;
        
        const normalizedSearchTerm = normalizeText(searchTerm.trim());
        const cleanSearchTerm = normalizedSearchTerm.replace(/[\s_\-]+/g, ' ');
        const isShortSearch = normalizedSearchTerm.length <= 2;

        return sourceDatasets.filter(dataset => {
            const normalizedTitle = normalizeText(dataset.title);
            const titleWords = normalizedTitle.split(/[\s_\-]+/);
            const matchesPrefix = titleWords.some(word => word.startsWith(normalizedSearchTerm));
            const cleanTitle = normalizedTitle.replace(/[\s_\-]+/g, ' ');
            const matchesSubstring = cleanTitle.includes(cleanSearchTerm);
            const matchesTitle = matchesPrefix || matchesSubstring;

            if (isShortSearch) {
                return matchesTitle;
            }

            const normalizedSnippet = normalizeText(dataset.snippet);
            const normalizedDescription = normalizeText(dataset.description);

            return matchesTitle || 
                   normalizedSnippet.includes(normalizedSearchTerm) || 
                   normalizedDescription.includes(normalizedSearchTerm);
        });
    }, [searchTerm, sourceDatasets]);

    return (
        <div id="sidebar">
            <h2>Búsqueda de Información</h2>
            
            {isLoading && (
                <div className="status-message loading">
                    Cargando catálogo cartográfico...
                </div>
            )}
            
            {hasError && !isLoading && (
                <div className="status-message error">
                    Error al conectar con ArcGIS Online. Por favor, recarga la página.
                </div>
            )}

            {!isLoading && !hasError && sourceDatasets.length === 0 && (
                <div className="status-message empty">
                    No se encontraron servicios en el catálogo.
                </div>
            )}

            {!isLoading && !hasError && sourceDatasets.length > 0 && !selectedDataset && (
                <>
                    <input 
                        type="text" 
                        id="search-input" 
                        placeholder="Buscar por palabra clave..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div id="card-container">
                        {filteredDatasets.length === 0 ? (
                             <div className="status-message empty">
                                 No hay resultados para esta búsqueda.
                             </div>
                        ) : (
                            filteredDatasets.map(dataset => (
                                <ItemCard 
                                    key={dataset.baseId}
                                    dataset={dataset}
                                    onClick={setSelectedDataset}
                                />
                            ))
                        )}
                    </div>
                </>
            )}

            {!isLoading && selectedDataset && (
                <ItemDetail 
                    dataset={selectedDataset}
                    legacyGdbId={data.logicalDatasets?.length ? undefined : data.gdbIdLookup.get(selectedDataset.title)}
                    onBack={() => setSelectedDataset(null)}
                    onAdd={onAddLayerToMap} 
                />
            )}
        </div>
    );
};

export default Catalog;
