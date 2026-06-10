import esriRequest from "@arcgis/core/request";
import { SEARCH_QUERY_URL } from "../config/constants";
import { CatalogResponse, ArcGISItem, LogicalDataset } from "../types";

const SEARCH_PAGE_SIZE = 100;
const MAX_SEARCH_PAGES = 100;
const PREFERRED_DATASET_KEY_TAG_PREFIX = "visor-dataset-key:";
const COMPATIBLE_DATASET_KEY_TAG_PREFIX = "datasetKey:";
const DATASET_KEY_TAG_PREFIXES = [
    PREFERRED_DATASET_KEY_TAG_PREFIX,
    COMPATIBLE_DATASET_KEY_TAG_PREFIX
];
const UNCLASSIFIED_VALUE = "Sin clasificar";

interface ArcGISSearchResponse {
    results?: ArcGISItem[];
    nextStart?: number | null;
}

interface DatasetKeyResolution {
    datasetKey: string;
    associationSource: "tag" | "title";
}

const normalizeTitleSpacing = (title: string): string => title.trim().replace(/\s+/g, " ");

const stripTechnicalSuffix = (item: ArcGISItem): string => {
    const cleanTitle = normalizeTitleSpacing(item.title);

    if (item.type === "File Geodatabase") {
        return cleanTitle.replace(/\s*_gdb\s*$/i, "").trim();
    }

    if (item.type === "Vector Tile Service") {
        return cleanTitle.replace(/\s*_vt\s*$/i, "").trim();
    }

    return cleanTitle;
};

const normalizeDatasetKey = (baseTitle: string): string =>
    normalizeTitleSpacing(baseTitle)
        .replace(/[_\s]+/g, " ")
        .toLowerCase();

const getDatasetKeyTagValue = (item: ArcGISItem, prefix: string): string | null => {
    const datasetKeyTag = item.tags
        ?.map(tag => tag.trim())
        .find(tag => tag.toLowerCase().startsWith(prefix.toLowerCase()));
    const rawValue = datasetKeyTag?.slice(prefix.length).trim();

    return rawValue ? normalizeDatasetKey(rawValue) : null;
};

const getMalformedDatasetKeyTags = (item: ArcGISItem): string[] =>
    item.tags
        ?.map(tag => tag.trim())
        .filter(tag =>
            DATASET_KEY_TAG_PREFIXES.some(prefix => tag.toLowerCase().startsWith(prefix.toLowerCase())) &&
            DATASET_KEY_TAG_PREFIXES.some(prefix =>
                tag.toLowerCase().startsWith(prefix.toLowerCase()) && !tag.slice(prefix.length).trim()
            )
        ) || [];

const resolveDatasetKeyFromItem = (item: ArcGISItem): DatasetKeyResolution => {
    const preferredDatasetKey = getDatasetKeyTagValue(item, PREFERRED_DATASET_KEY_TAG_PREFIX);

    if (preferredDatasetKey) {
        return { datasetKey: preferredDatasetKey, associationSource: "tag" };
    }

    const compatibleDatasetKey = getDatasetKeyTagValue(item, COMPATIBLE_DATASET_KEY_TAG_PREFIX);

    if (compatibleDatasetKey) {
        return { datasetKey: compatibleDatasetKey, associationSource: "tag" };
    }

    // Fallback seguro: usa el titulo base completo, no solo el municipio.
    // Agua de Dios 1:1.000 y 1:10.000 deben permanecer como datasets separados.
    return { datasetKey: normalizeDatasetKey(stripTechnicalSuffix(item)), associationSource: "title" };
};

export const getDatasetKeyFromItem = (item: ArcGISItem): string =>
    resolveDatasetKeyFromItem(item).datasetKey;

const formatScale = (scaleDenominator: string): string => {
    const numericScale = scaleDenominator.replace(/\D/g, "");
    return numericScale ? `1:${Number(numericScale).toLocaleString("es-CO")}` : UNCLASSIFIED_VALUE;
};

const getScaleFromTitle = (title: string): string => {
    const match = title.match(/(?:escala\s*)?1\s*:\s*([0-9.]+)/i);
    return match ? formatScale(match[1]) : UNCLASSIFIED_VALUE;
};

const getMunicipalityFromTitle = (title: string): string => {
    const match = title.match(/Municipio\s+de\s+(.+?)\s+del\s+Departamento/i);
    return match ? normalizeTitleSpacing(match[1]) : UNCLASSIFIED_VALUE;
};

const getYearFromTitle = (title: string): string => {
    const yearMatch = title.match(/(?:Año|Ano)\s*(19\d{2}|20\d{2})/i) || title.match(/\b(19\d{2}|20\d{2})\b/);
    return yearMatch ? yearMatch[1] : UNCLASSIFIED_VALUE;
};

const getDerivedDatasetMetadata = (baseTitle: string): Pick<LogicalDataset, "municipio" | "escala" | "anio"> => ({
    municipio: getMunicipalityFromTitle(baseTitle),
    escala: getScaleFromTitle(baseTitle),
    anio: getYearFromTitle(baseTitle)
});

const summarizeItem = (item?: ArcGISItem) => item ? ({
    title: item.title,
    id: item.id,
    type: item.type
}) : null;

const summarizeDataset = (dataset: LogicalDataset) => ({
    datasetKey: dataset.datasetKey,
    associationSource: dataset.associationSource,
    title: dataset.title,
    municipio: dataset.municipio,
    escala: dataset.escala,
    anio: dataset.anio,
    featureService: Boolean(dataset.featureService),
    fileGeodatabase: Boolean(dataset.fileGeodatabase),
    vectorTile: Boolean(dataset.vectorTile),
    featureServiceId: dataset.featureService?.id,
    fileGeodatabaseId: dataset.fileGeodatabase?.id,
    vectorTileId: dataset.vectorTile?.id
});

const getDatasetExamplesByTitle = (logicalDatasets: LogicalDataset[], searchTerm: string) =>
    logicalDatasets
        .filter(dataset => dataset.title.toLowerCase().includes(searchTerm.toLowerCase()))
        .map(summarizeDataset);

const getMalformedDatasetKeyTagDiagnostics = (items: ArcGISItem[]) =>
    items.flatMap(item =>
        getMalformedDatasetKeyTags(item).map(tag => ({
            title: item.title,
            id: item.id,
            type: item.type,
            tag
        }))
    );

const getTechnicalTypeCollisions = (items: ArcGISItem[]) => {
    const resourcesByDatasetAndType = new Map<string, { datasetKey: string; type: ArcGISItem["type"]; items: ArcGISItem[] }>();

    items.forEach(item => {
        const datasetKey = getDatasetKeyFromItem(item);
        const collisionKey = `${datasetKey}::${item.type}`;
        const resources = resourcesByDatasetAndType.get(collisionKey) || {
            datasetKey,
            type: item.type,
            items: []
        };

        resources.items.push(item);
        resourcesByDatasetAndType.set(collisionKey, resources);
    });

    return Array.from(resourcesByDatasetAndType.values())
        .filter(resources => resources.items.length > 1)
        .map(resources => ({
            datasetKey: resources.datasetKey,
            type: resources.type,
            items: resources.items.map(summarizeItem)
        }));
};

const getDatasetResourceByType = (dataset: LogicalDataset, type: ArcGISItem["type"]): ArcGISItem | undefined => {
    if (type === "Feature Service") {
        return dataset.featureService;
    }

    if (type === "Vector Tile Service") {
        return dataset.vectorTile;
    }

    return dataset.fileGeodatabase;
};

const warnIfTechnicalResourceWillBeOverwritten = (dataset: LogicalDataset, incomingItem: ArcGISItem): void => {
    const existingItem = getDatasetResourceByType(dataset, incomingItem.type);

    if (!existingItem || existingItem.id === incomingItem.id) {
        return;
    }

    console.warn("[Catalog diagnostics] Recurso tecnico duplicado para el mismo LogicalDataset.", {
        datasetKey: dataset.datasetKey,
        type: incomingItem.type,
        existingItem: summarizeItem(existingItem),
        incomingItem: summarizeItem(incomingItem)
    });
};

const buildSearchPageUrl = (start: number): string => {
    const [baseUrl, queryString = ""] = SEARCH_QUERY_URL.split("?");
    const queryParams = queryString
        .split("&")
        .filter(Boolean)
        .filter(param => !/^num=/i.test(param) && !/^start=/i.test(param));

    queryParams.push(`num=${SEARCH_PAGE_SIZE}`, `start=${start}`);
    return `${baseUrl}?${queryParams.join("&")}`;
};

const fetchAllSearchItems = async (): Promise<ArcGISItem[]> => {
    const itemsById = new Map<string, ArcGISItem>();
    let start = 1;
    let pageCount = 0;

    while (start > 0 && pageCount < MAX_SEARCH_PAGES) {
        pageCount += 1;
        const response = await esriRequest(buildSearchPageUrl(start), { responseType: "json" });
        const data = response.data as ArcGISSearchResponse;
        const pageItems = data.results || [];

        pageItems.forEach(item => {
            itemsById.set(item.id, item);
        });

        if (data.nextStart && data.nextStart !== -1 && pageItems.length > 0) {
            start = data.nextStart;
        } else {
            start = -1;
        }
    }

    if (pageCount >= MAX_SEARCH_PAGES) {
        console.warn("La paginación del catálogo alcanzó el límite defensivo de páginas.", {
            maxPages: MAX_SEARCH_PAGES,
            retrievedItems: itemsById.size
        });
    }

    return Array.from(itemsById.values());
};

const logCatalogDiagnostics = (
    allItems: ArcGISItem[],
    logicalDatasets: LogicalDataset[],
    loadDurationMs: number
): void => {
    if (!import.meta.env.DEV) {
        return;
    }

    const countByType = allItems.reduce<Record<string, number>>((accumulator, item) => {
        accumulator[item.type] = (accumulator[item.type] || 0) + 1;
        return accumulator;
    }, {});
    const logicalWithFeatureService = logicalDatasets.filter(dataset => dataset.featureService).length;
    const logicalWithFileGeodatabase = logicalDatasets.filter(dataset => dataset.fileGeodatabase).length;
    const logicalWithVectorTile = logicalDatasets.filter(dataset => dataset.vectorTile).length;
    const logicalAssociatedByTag = logicalDatasets.filter(dataset => dataset.associationSource === "tag").length;
    const logicalAssociatedByTitle = logicalDatasets.filter(dataset => dataset.associationSource === "title").length;
    const featureServicesWithoutGdbDatasets = logicalDatasets
        .filter(dataset => dataset.featureService && !dataset.fileGeodatabase)
        .map(summarizeDataset);
    const gdbWithoutFeatureServiceDatasets = logicalDatasets
        .filter(dataset => dataset.fileGeodatabase && !dataset.featureService)
        .map(summarizeDataset);
    const malformedDatasetKeyTags = getMalformedDatasetKeyTagDiagnostics(allItems);
    const technicalTypeCollisions = getTechnicalTypeCollisions(allItems);
    const laPalmaDatasets = getDatasetExamplesByTitle(logicalDatasets, "la palma");
    const veneciaDatasets = getDatasetExamplesByTitle(logicalDatasets, "venecia");

    const diagnostics = {
        totalItems: allItems.length,
        countByType,
        totalLogicalDatasets: logicalDatasets.length,
        logicalAssociatedByTag,
        logicalAssociatedByTitle,
        logicalWithFeatureService,
        logicalWithFileGeodatabase,
        logicalWithVectorTile,
        featureServicesWithoutGdb: featureServicesWithoutGdbDatasets.length,
        gdbWithoutFeatureService: gdbWithoutFeatureServiceDatasets.length,
        malformedDatasetKeyTags,
        featureServicesWithoutGdbDatasets,
        gdbWithoutFeatureServiceDatasets,
        technicalTypeCollisions,
        loadDurationMs: Math.round(loadDurationMs),
        laPalmaDatasets,
        veneciaDatasets
    };

    console.info("[Catalog diagnostics] ArcGIS Search pagination", diagnostics);
    console.info("[Catalog diagnostics JSON]", JSON.stringify(diagnostics));

    if (malformedDatasetKeyTags.length > 0) {
        console.warn("[Catalog diagnostics] Tags datasetKey mal formados.", malformedDatasetKeyTags);
    }

    if (technicalTypeCollisions.length > 0) {
        console.warn("[Catalog diagnostics] Posibles sobrescrituras por tipo tecnico duplicado.", technicalTypeCollisions);
    }
};

export function buildLogicalDatasets(items: ArcGISItem[]): LogicalDataset[] {
    const datasetMap = new Map<string, LogicalDataset>();

    items.forEach(item => {
        const baseName = stripTechnicalSuffix(item);
        // La llave de agrupacion nunca debe reducirse al municipio: producto,
        // escala y anio diferencian datasets publicados para un mismo municipio.
        const { datasetKey, associationSource } = resolveDatasetKeyFromItem(item);

        if (!datasetMap.has(datasetKey)) {
            datasetMap.set(datasetKey, {
                baseId: datasetKey,
                datasetKey,
                associationSource,
                title: baseName,
                ...getDerivedDatasetMetadata(baseName)
            });
        }

        const logicalDataset = datasetMap.get(datasetKey)!;

        if (associationSource === "tag") {
            logicalDataset.associationSource = "tag";
        }

        warnIfTechnicalResourceWillBeOverwritten(logicalDataset, item);

        if (item.type === "Feature Service") {
            logicalDataset.featureService = item;
            logicalDataset.title = item.title;
            logicalDataset.snippet = item.snippet || logicalDataset.snippet;
            logicalDataset.description = item.description || logicalDataset.description;
            logicalDataset.thumbnail = item.thumbnail || logicalDataset.thumbnail;
        } else if (item.type === "Vector Tile Service") {
            logicalDataset.vectorTile = item;
            logicalDataset.snippet = logicalDataset.snippet || item.snippet;
            logicalDataset.description = logicalDataset.description || item.description;
            logicalDataset.thumbnail = logicalDataset.thumbnail || item.thumbnail;
        } else if (item.type === "File Geodatabase") {
            logicalDataset.fileGeodatabase = item;
        }
    });

    return Array.from(datasetMap.values());
}

export async function fetchCatalogItems(): Promise<CatalogResponse> {
    try {
        const loadStart = performance.now();
        const allItems = await fetchAllSearchItems();
        const logicalDatasets = buildLogicalDatasets(allItems);
        logCatalogDiagnostics(allItems, logicalDatasets, performance.now() - loadStart);

        const gdbIdLookup = new Map<string, string>();
        const featureServices: ArcGISItem[] = [];

        allItems.forEach(item => {
            if (item.type === "File Geodatabase" && /\s*_gdb\s*$/i.test(item.title)) {
                gdbIdLookup.set(stripTechnicalSuffix(item), item.id);
            }

            if (item.type === "Feature Service") {
                featureServices.push(item);
            }
        });

        return { data: { featureServices, gdbIdLookup, logicalDatasets }, error: false };
    } catch (error) {
        console.error("Error al buscar ítems en ArcGIS Online:", error);
        return { data: null, error: true };
    }
}
