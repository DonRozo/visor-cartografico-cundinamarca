import React from 'react';
import { ArcGISItem, LogicalDataset } from '../../types';
import { PORTAL_URL } from '../../config/constants';

interface ItemDetailProps {
    dataset: LogicalDataset;
    legacyGdbId?: string;
    onBack: () => void;
    onAdd: (item: ArcGISItem) => void;
}

// Panel de metadatos y botones de acción.
const ItemDetail: React.FC<ItemDetailProps> = ({ dataset, legacyGdbId, onBack, onAdd }) => {
    const preferredMapResource = dataset.vectorTile || dataset.featureService;
    const mapItem = preferredMapResource && dataset.vectorTile && dataset.featureService
        ? { ...preferredMapResource, fallbackFeatureService: dataset.featureService }
        : preferredMapResource;
    const gdbId = dataset.fileGeodatabase?.id || legacyGdbId;
    const thumbnailItem = dataset.featureService?.thumbnail
        ? dataset.featureService
        : dataset.vectorTile?.thumbnail
            ? dataset.vectorTile
            : dataset.fileGeodatabase;

    const thumbnailUrl = dataset.thumbnail && thumbnailItem
        ? `${PORTAL_URL}/sharing/rest/content/items/${thumbnailItem.id}/info/${dataset.thumbnail}`
        : `${PORTAL_URL}/home/images/shared/bb_results-no-preview.png`;

    const descriptionContent = dataset.description || dataset.snippet || "No hay descripción disponible.";

    const buildGdbDownloadUrl = (gdbItemId: string): string =>
        `${PORTAL_URL}/sharing/rest/content/items/${encodeURIComponent(gdbItemId)}/data`;

    const handleDownloadGdb = (): void => {
        if (!gdbId) {
            return;
        }

        const temporaryLink = document.createElement('a');
        temporaryLink.href = buildGdbDownloadUrl(gdbId);
        temporaryLink.download = '';
        document.body.appendChild(temporaryLink);
        temporaryLink.click();
        document.body.removeChild(temporaryLink);
    };

    return (
        <div id="detail-pane" style={{ display: 'block' }}>
            <img src={thumbnailUrl} alt={dataset.title} className="detail-thumbnail" />
            <h3>{dataset.title}</h3>
            
            {/* La descripción de ArcGIS Online puede incluir HTML con etiquetas de bloque. */}
            <div 
                className="detail-description" 
                dangerouslySetInnerHTML={{ __html: descriptionContent }}
            />
            
            <div className="metadata-buttons">
                {mapItem && (
                    <button type="button" className="pill-button" onClick={() => onAdd(mapItem)}>
                        Añadir al Mapa
                    </button>
                )}
                
                {gdbId && (
                    <button type="button" className="pill-button" onClick={handleDownloadGdb}>
                        Descargar GDB
                    </button>
                )}
                
                <button type="button" className="pill-button secondary" onClick={onBack}>
                    ← Volver a la búsqueda
                </button>
            </div>
        </div>
    );
};

export default ItemDetail;
