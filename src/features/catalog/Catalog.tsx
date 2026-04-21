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

// Función auxiliar para mapear temporalmente un LogicalDataset a un ArcGISItem.
// Solo permitimos convertir aquellos que tengan un Feature Service, garantizando
// la compatibilidad con la lógica actual de agregar capas operativas al mapa.
const mapLogicalDatasetToItem = (ld: LogicalDataset): ArcGISItem | null => {
    // Exigimos estrictamente que exista el Feature Service. 
    // Ignoramos temporalmente los datasets que solo tienen Vector Tile o GDB.
    if (!ld.featureService) return null;

    return {
        id: ld.featureService.id,
        title: ld.title, // Usamos el título consolidado y limpio sin sufijos
        type: ld.featureService.type,
        url: ld.featureService.url,
        thumbnail: ld.thumbnail,
        snippet: ld.snippet,
        description: ld.description
    };
};

// Orquestador del panel lateral con manejo de estados visuales y búsqueda avanzada
const Catalog: React.FC<CatalogProps> = ({ data, isLoading, hasError, onAddLayerToMap }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedItem, setSelectedItem] = useState<ArcGISItem | null>(null);

    // Determinamos la fuente de datos unificada de forma progresiva.
    // Si existen datasets lógicos los usamos, sino usamos la estructura legacy.
    const sourceItems = useMemo(() => {
        if (data.logicalDatasets && data.logicalDatasets.length > 0) {
            return data.logicalDatasets
                .map(mapLogicalDatasetToItem)
                // Eliminamos los nulos (datasets sin Feature Service)
                .filter((item): item is ArcGISItem => item !== null);
        }
        // Fallback robusto a la estructura original si la nueva no viene en los datos
        return data.featureServices || [];
    }, [data.logicalDatasets, data.featureServices]);

    // [CORRECCIÓN QUIRÚRGICA] Filtra dinámicamente controlando el ruido en términos cortos
    const filteredItems = useMemo(() => {
        if (!searchTerm) return sourceItems;
        
        const normalizedSearchTerm = normalizeText(searchTerm.trim());
        const cleanSearchTerm = normalizedSearchTerm.replace(/[\s_\-]+/g, ' ');
        const isShortSearch = normalizedSearchTerm.length <= 2;

        return sourceItems.filter(item => {
            const normalizedTitle = normalizeText(item.title);
            
            // --- 1. MEJORA DE COINCIDENCIA EN NOMBRES TÉCNICOS (TITLE) ---
            // Separamos por espacios, guiones o guiones bajos
            const titleWords = normalizedTitle.split(/[\s_\-]+/);
            
            // A) Coincidencia por prefijo (ej: "ad" encuentra "admin")
            const matchesPrefix = titleWords.some(word => word.startsWith(normalizedSearchTerm));
            
            // B) Coincidencia general reemplazando separadores técnicos por espacios
            const cleanTitle = normalizedTitle.replace(/[\s_\-]+/g, ' ');
            const matchesSubstring = cleanTitle.includes(cleanSearchTerm);
            
            const matchesTitle = matchesPrefix || matchesSubstring;

            // --- 2. REGLA PARA BÚSQUEDAS CORTAS (1 a 2 caracteres) ---
            if (isShortSearch) {
                // Solo buscamos en el título para evitar el ruido enorme de las descripciones
                return matchesTitle;
            }

            // --- 3. REGLA PARA BÚSQUEDAS LARGAS (3 o más caracteres) ---
            const normalizedSnippet = normalizeText(item.snippet);
            const normalizedDescription = normalizeText(item.description);

            return matchesTitle || 
                   normalizedSnippet.includes(normalizedSearchTerm) || 
                   normalizedDescription.includes(normalizedSearchTerm);
        });
    }, [searchTerm, sourceItems]);

    return (
        <div id="sidebar">
            <h2>Búsqueda de Información</h2>
            
            {/* ESTADO 1: Cargando el catálogo */}
            {isLoading && (
                <div className="status-message loading">
                    Cargando catálogo cartográfico...
                </div>
            )}
            
            {/* ESTADO 2: Error al obtener los datos */}
            {hasError && !isLoading && (
                <div className="status-message error">
                    Error al conectar con ArcGIS Online. Por favor, recarga la página.
                </div>
            )}

            {/* ESTADO 3: Catálogo vacío (la petición fue exitosa pero no hay elementos) */}
            {!isLoading && !hasError && sourceItems.length === 0 && (
                <div className="status-message empty">
                    No se encontraron servicios en el catálogo.
                </div>
            )}

            {/* VISTA PRINCIPAL: Muestra la barra de búsqueda y las tarjetas */}
            {!isLoading && !hasError && sourceItems.length > 0 && !selectedItem && (
                <>
                    <input 
                        type="text" 
                        id="search-input" 
                        placeholder="Buscar por palabra clave..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div id="card-container">
                        {/* ESTADO 4: Búsqueda sin resultados */}
                        {filteredItems.length === 0 ? (
                             <div className="status-message empty">
                                 No hay resultados para esta búsqueda.
                             </div>
                        ) : (
                            filteredItems.map(item => (
                                <ItemCard 
                                    key={item.id} 
                                    item={item} 
                                    onClick={setSelectedItem} 
                                />
                            ))
                        )}
                    </div>
                </>
            )}

            {/* VISTA DE DETALLE: Muestra la información extendida del elemento seleccionado */}
            {!isLoading && selectedItem && (
                <ItemDetail 
                    item={selectedItem} 
                    // El título aquí ya está limpio y coincide con la llave en gdbIdLookup
                    gdbId={data.gdbIdLookup.get(selectedItem.title)} 
                    onBack={() => setSelectedItem(null)} 
                    onAdd={onAddLayerToMap} 
                />
            )}
        </div>
    );
};

export default Catalog;