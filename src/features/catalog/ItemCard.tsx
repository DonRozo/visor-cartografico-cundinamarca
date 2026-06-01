import React from 'react';
import { LogicalDataset } from '../../types';
import { PORTAL_URL } from '../../config/constants';

interface ItemCardProps {
    dataset: LogicalDataset;
    onClick: (dataset: LogicalDataset) => void;
}

// Representación visual de una tarjeta del catálogo.
const ItemCard: React.FC<ItemCardProps> = ({ dataset, onClick }) => {
    const thumbnailItem = dataset.featureService?.thumbnail
        ? dataset.featureService
        : dataset.vectorTile?.thumbnail
            ? dataset.vectorTile
            : dataset.fileGeodatabase;

    const thumbnailUrl = dataset.thumbnail && thumbnailItem
        ? `${PORTAL_URL}/sharing/rest/content/items/${thumbnailItem.id}/info/${dataset.thumbnail}`
        : `${PORTAL_URL}/home/images/shared/bb_results-no-preview.png`;

    return (
        <div className="card" onClick={() => onClick(dataset)}>
            <div className="card-inner">
                <div className="card-front">
                    <img src={thumbnailUrl} alt={dataset.title} />
                    <div className="card-title">{dataset.title}</div>
                </div>
                <div className="card-back">
                    <p>{dataset.snippet || "No hay resumen disponible."}</p>
                </div>
            </div>
        </div>
    );
};

export default ItemCard;
