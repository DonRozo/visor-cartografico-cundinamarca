import esriRequest from "@arcgis/core/request";
import { SEARCH_QUERY_URL } from "../config/constants";
import { CatalogResponse, ArcGISItem, LogicalDataset } from "../types";

const SEARCH_PAGE_SIZE = 100;
const MAX_SEARCH_PAGES = 100;
const UNCLASSIFIED_VALUE = "Sin clasificar";

interface ArcGISSearchResponse {
    results?: ArcGISItem[];
    nextStart?: number | null;
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

export const getDatasetKeyFromItem = (item: ArcGISItem): string =>
    normalizeDatasetKey(stripTechnicalSuffix(item));

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
    const featureServicesWithoutGdb = logicalDatasets.filter(dataset =>
        dataset.featureService && !dataset.fileGeodatabase
    ).length;
    const gdbWithoutFeatureService = logicalDatasets.filter(dataset =>
        dataset.fileGeodatabase && !dataset.featureService
    ).length;
    const laPalmaDatasets = logicalDatasets
        .filter(dataset => dataset.title.toLowerCase().includes("la palma"))
        .map(dataset => ({
            datasetKey: dataset.datasetKey,
            title: dataset.title,
            municipio: dataset.municipio,
            escala: dataset.escala,
            anio: dataset.anio,
            featureService: Boolean(dataset.featureService),
            fileGeodatabase: Boolean(dataset.fileGeodatabase),
            vectorTile: Boolean(dataset.vectorTile),
            featureServiceId: dataset.featureService?.id,
            fileGeodatabaseId: dataset.fileGeodatabase?.id
        }));

    const diagnostics = {
        totalItems: allItems.length,
        countByType,
        totalLogicalDatasets: logicalDatasets.length,
        logicalWithFeatureService,
        logicalWithFileGeodatabase,
        logicalWithVectorTile,
        featureServicesWithoutGdb,
        gdbWithoutFeatureService,
        loadDurationMs: Math.round(loadDurationMs),
        laPalmaDatasets
    };

    console.info("[Catalog diagnostics] ArcGIS Search pagination", diagnostics);
    console.info("[Catalog diagnostics JSON]", JSON.stringify(diagnostics));
};

export function buildLogicalDatasets(items: ArcGISItem[]): LogicalDataset[] {
    const datasetMap = new Map<string, LogicalDataset>();

    items.forEach(item => {
        const baseName = stripTechnicalSuffix(item);
        const datasetKey = getDatasetKeyFromItem(item);

        if (!datasetMap.has(datasetKey)) {
            datasetMap.set(datasetKey, {
                baseId: datasetKey,
                datasetKey,
                title: baseName,
                ...getDerivedDatasetMetadata(baseName)
            });
        }

        const logicalDataset = datasetMap.get(datasetKey)!;

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
