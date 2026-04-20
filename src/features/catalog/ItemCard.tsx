import React from 'react';
import { ArcGISItem } from '../../types';
import { PORTAL_URL } from '../../config/constants';

// Definición estricta de las props que realmente necesita la tarjeta
interface ItemCardProps {
    item: ArcGISItem;
    onClick: (item: ArcGISItem) => void;
}

// Representación visual de una tarjeta del catálogo.
const ItemCard: React.FC<ItemCardProps> = ({ item, onClick }) => {
    // Construcción de la URL de la miniatura de forma segura
    const thumbnailUrl = item.thumbnail 
        ? `${PORTAL_URL}/sharing/rest/content/items/${item.id}/info/${item.thumbnail}` 
        : `${PORTAL_URL}/home/images/shared/bb_results-no-preview.png`;

    return (
        <div className="card" onClick={() => onClick(item)}>
            <div className="card-inner">
                <div className="card-front">
                    <img src={thumbnailUrl} alt={item.title} />
                    <div className="card-title">{item.title}</div>
                </div>
                <div className="card-back">
                    <p>{item.snippet || "No hay resumen disponible."}</p>
                </div>
            </div>
        </div>
    );
};

export default ItemCard;