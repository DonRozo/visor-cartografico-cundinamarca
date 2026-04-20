import React from 'react';
import { ArcGISItem } from '../../types';
import { PORTAL_URL, OPEN_DATA_URL_BASE } from '../../config/constants';

// Definición de las propiedades que recibe el componente
interface ItemDetailProps {
    item: ArcGISItem;
    gdbId?: string;
    onBack: () => void;
    onAdd: (item: ArcGISItem) => void;
}

// Panel de metadatos y botones de acción.
const ItemDetail: React.FC<ItemDetailProps> = ({ item, gdbId, onBack, onAdd }) => {
    // Construcción de la URL de la miniatura con imagen por defecto como fallback
    const thumbnailUrl = item.thumbnail 
        ? `${PORTAL_URL}/sharing/rest/content/items/${item.id}/info/${item.thumbnail}` 
        : `${PORTAL_URL}/home/images/shared/bb_results-no-preview.png`;

    // Determinamos el contenido de la descripción respetando la prioridad exigida
    const descriptionContent = item.description || item.snippet || "No hay descripción disponible.";

    return (
        <div id="detail-pane" style={{ display: 'block' }}>
            <img src={thumbnailUrl} alt={item.title} className="detail-thumbnail" />
            <h3>{item.title}</h3>
            
            {/* [CORRECCIÓN] Usamos 'dangerouslySetInnerHTML' para renderizar el HTML crudo
              proveniente de ArcGIS Online. Usamos un <div> en lugar de <p> porque la 
              descripción podría contener etiquetas de bloque (como tablas o listas) que 
              son inválidas dentro de un párrafo.
            */}
            <div 
                className="detail-description" 
                dangerouslySetInnerHTML={{ __html: descriptionContent }}
            />
            
            <div className="metadata-buttons">
                <button className="pill-button" onClick={() => onAdd(item)}>
                    Añadir al Mapa
                </button>
                
                {gdbId && (
                    <a href={`${OPEN_DATA_URL_BASE}${gdbId}/about`} className="pill-button" target="_blank" rel="noreferrer">
                        Descargar GDB
                    </a>
                )}
                
                <button className="pill-button secondary" onClick={onBack}>
                    ← Volver a la búsqueda
                </button>
            </div>
        </div>
    );
};

export default ItemDetail;