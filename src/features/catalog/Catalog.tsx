import React, { useState, useMemo } from 'react';
import ItemCard from './ItemCard';
import ItemDetail from './ItemDetail';
import { CatalogData, ArcGISItem, LogicalDataset } from '../../types';

interface CatalogProps {
    data: CatalogData;
    isLoading: boolean;
    hasError: boolean;
    onAddLayerToMap: (item: ArcGISItem) => void;
}

interface SearchableDataset {
    dataset: LogicalDataset;
    normalizedTitle: string;
    normalizedSnippet: string;
    normalizedDescription: string;
}

const UNCLASSIFIED_VALUE = "Sin clasificar";
const ALL_VALUE = "";

const normalizeText = (text?: string): string => {
    if (!text) return "";
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

const mapLegacyItemToLogicalDataset = (item: ArcGISItem): LogicalDataset => ({
    baseId: item.id,
    datasetKey: item.id,
    title: item.title,
    municipio: UNCLASSIFIED_VALUE,
    escala: UNCLASSIFIED_VALUE,
    anio: UNCLASSIFIED_VALUE,
    thumbnail: item.thumbnail,
    snippet: item.snippet,
    description: item.description,
    featureService: item
});

const sortFilterValues = (values: string[]): string[] =>
    values.sort((left, right) => {
        if (left === UNCLASSIFIED_VALUE) return 1;
        if (right === UNCLASSIFIED_VALUE) return -1;
        return left.localeCompare(right, 'es', { numeric: true, sensitivity: 'base' });
    });

const getUniqueFilterValues = (
    datasets: LogicalDataset[],
    field: 'municipio' | 'escala' | 'anio'
): string[] => sortFilterValues(Array.from(new Set(
    datasets.map(dataset => dataset[field] || UNCLASSIFIED_VALUE)
)));

const Catalog: React.FC<CatalogProps> = ({ data, isLoading, hasError, onAddLayerToMap }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedMunicipality, setSelectedMunicipality] = useState(ALL_VALUE);
    const [selectedScale, setSelectedScale] = useState(ALL_VALUE);
    const [selectedYear, setSelectedYear] = useState(ALL_VALUE);
    const [selectedDataset, setSelectedDataset] = useState<LogicalDataset | null>(null);

    const sourceDatasets = useMemo(() => {
        if (data.logicalDatasets && data.logicalDatasets.length > 0) {
            return data.logicalDatasets.filter(dataset => dataset.vectorTile || dataset.featureService);
        }
        return (data.featureServices || []).map(mapLegacyItemToLogicalDataset);
    }, [data.logicalDatasets, data.featureServices]);

    const searchableDatasets = useMemo<SearchableDataset[]>(() =>
        sourceDatasets.map(dataset => ({
            dataset,
            normalizedTitle: normalizeText(dataset.title),
            normalizedSnippet: normalizeText(dataset.snippet),
            normalizedDescription: normalizeText(dataset.description)
        })), [sourceDatasets]);

    const municipalityOptions = useMemo(() =>
        getUniqueFilterValues(sourceDatasets, 'municipio'), [sourceDatasets]);
    const scaleOptions = useMemo(() =>
        getUniqueFilterValues(sourceDatasets, 'escala'), [sourceDatasets]);
    const yearOptions = useMemo(() =>
        getUniqueFilterValues(sourceDatasets, 'anio'), [sourceDatasets]);

    const filteredDatasets = useMemo(() => {
        const normalizedSearchTerm = normalizeText(searchTerm.trim());
        const cleanSearchTerm = normalizedSearchTerm.replace(/[\s_\-]+/g, ' ');
        const isShortSearch = normalizedSearchTerm.length <= 2;

        return searchableDatasets
            .filter(({ dataset }) => {
                const matchesMunicipality = !selectedMunicipality || dataset.municipio === selectedMunicipality;
                const matchesScale = !selectedScale || dataset.escala === selectedScale;
                const matchesYear = !selectedYear || dataset.anio === selectedYear;
                return matchesMunicipality && matchesScale && matchesYear;
            })
            .filter(({ dataset, normalizedTitle, normalizedSnippet, normalizedDescription }) => {
                if (!normalizedSearchTerm) return true;

                const titleWords = normalizedTitle.split(/[\s_\-]+/);
                const matchesPrefix = titleWords.some(word => word.startsWith(normalizedSearchTerm));
                const cleanTitle = normalizedTitle.replace(/[\s_\-]+/g, ' ');
                const matchesSubstring = cleanTitle.includes(cleanSearchTerm);
                const matchesTitle = matchesPrefix || matchesSubstring;

                if (isShortSearch) {
                    return matchesTitle;
                }

                const normalizedMetadata = normalizeText([
                    dataset.municipio,
                    dataset.escala,
                    dataset.anio
                ].filter(Boolean).join(" "));

                return matchesTitle ||
                    normalizedSnippet.includes(normalizedSearchTerm) ||
                    normalizedDescription.includes(normalizedSearchTerm) ||
                    normalizedMetadata.includes(normalizedSearchTerm);
            })
            .map(({ dataset }) => dataset);
    }, [searchTerm, searchableDatasets, selectedMunicipality, selectedScale, selectedYear]);

    const handleDatasetSelect = (dataset: LogicalDataset): void => {
        setSelectedDataset(dataset);
    };

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
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />

                    <div className="catalog-filters">
                        <select
                            aria-label="Filtrar por municipio"
                            value={selectedMunicipality}
                            onChange={(event) => setSelectedMunicipality(event.target.value)}
                        >
                            <option value={ALL_VALUE}>Todos los municipios</option>
                            {municipalityOptions.map(municipality => (
                                <option key={municipality} value={municipality}>{municipality}</option>
                            ))}
                        </select>

                        <select
                            aria-label="Filtrar por escala"
                            value={selectedScale}
                            onChange={(event) => setSelectedScale(event.target.value)}
                        >
                            <option value={ALL_VALUE}>Todas las escalas</option>
                            {scaleOptions.map(scale => (
                                <option key={scale} value={scale}>{scale}</option>
                            ))}
                        </select>

                        <select
                            aria-label="Filtrar por año"
                            value={selectedYear}
                            onChange={(event) => setSelectedYear(event.target.value)}
                        >
                            <option value={ALL_VALUE}>Todos los años</option>
                            {yearOptions.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>

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
                                    onClick={handleDatasetSelect}
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
