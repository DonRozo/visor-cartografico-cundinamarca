import React, { useState, useMemo } from 'react';
import ItemCard from './ItemCard';
import ItemDetail from './ItemDetail';
import { CatalogData, ArcGISItem } from '../../types';

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

// Orquestador del panel lateral con manejo de estados visuales y búsqueda avanzada
const Catalog: React.FC<CatalogProps> = ({ data, isLoading, hasError, onAddLayerToMap }) => {
    // Estado para el término de búsqueda ingresado por el usuario
    const [searchTerm, setSearchTerm] = useState("");
    // Estado para el elemento seleccionado (si es null, muestra la lista del catálogo)
    const [selectedItem, setSelectedItem] = useState<ArcGISItem | null>(null);

    // Filtra dinámicamente los servicios según el término de búsqueda en título, resumen y descripción
    const filteredItems = useMemo(() => {
        if (!searchTerm) return data.featureServices;
        
        const normalizedSearchTerm = normalizeText(searchTerm.trim());

        return data.featureServices.filter(item => {
            // Normalizamos los metadatos del item para compararlos
            const normalizedTitle = normalizeText(item.title);
            const normalizedSnippet = normalizeText(item.snippet);
            const normalizedDescription = normalizeText(item.description);

            // Retorna true si el término de búsqueda existe en cualquiera de los 3 campos
            return normalizedTitle.includes(normalizedSearchTerm) || 
                   normalizedSnippet.includes(normalizedSearchTerm) || 
                   normalizedDescription.includes(normalizedSearchTerm);
        });
    }, [searchTerm, data.featureServices]);

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
            {!isLoading && !hasError && data.featureServices.length === 0 && (
                <div className="status-message empty">
                    No se encontraron servicios en el catálogo.
                </div>
            )}

            {/* VISTA PRINCIPAL: Muestra la barra de búsqueda y las tarjetas */}
            {!isLoading && !hasError && data.featureServices.length > 0 && !selectedItem && (
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
                    gdbId={data.gdbIdLookup.get(selectedItem.title)} 
                    onBack={() => setSelectedItem(null)} 
                    onAdd={onAddLayerToMap} 
                />
            )}
        </div>
    );
};

export default Catalog;