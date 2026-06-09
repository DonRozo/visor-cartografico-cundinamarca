import WebMap from "@arcgis/core/WebMap";
import MapView from "@arcgis/core/views/MapView";
import esriRequest from "@arcgis/core/request";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import VectorTileLayer from "@arcgis/core/layers/VectorTileLayer";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import Extent from "@arcgis/core/geometry/Extent";

// Importacion de Widgets Nativos
import Search from "@arcgis/core/widgets/Search";
import BasemapGallery from "@arcgis/core/widgets/BasemapGallery";
import Measurement from "@arcgis/core/widgets/Measurement";
import Print from "@arcgis/core/widgets/Print";
import LayerList from "@arcgis/core/widgets/LayerList";
import Legend from "@arcgis/core/widgets/Legend";
import Sketch from "@arcgis/core/widgets/Sketch";

import { WEB_MAP_ID, PRINT_SERVICE_URL } from "../../config/constants";
import { ArcGISItem, MapWidgets } from "../../types";

interface ServiceLayerInfo {
    id: number;
    name: string;
}

type CatalogLayerWithGroup = __esri.Layer & { groupId?: string };
type FocusableCatalogLayer = FeatureLayer | VectorTileLayer;

const WORLD_GEOGRAPHIC_WIDTH = 300;
const WORLD_GEOGRAPHIC_HEIGHT = 140;
const WORLD_WEB_MERCATOR_WIDTH = 35000000;
const WORLD_WEB_MERCATOR_HEIGHT = 25000000;

const CUNDINAMARCA_GEOGRAPHIC_BOUNDS = {
    xmin: -75.8,
    ymin: 2.8,
    xmax: -72.3,
    ymax: 6.2
};

const CUNDINAMARCA_WEB_MERCATOR_BOUNDS = {
    xmin: -8438000,
    ymin: 311000,
    xmax: -8048000,
    ymax: 692000
};

export function initializeMap(container: HTMLDivElement): { 
    map: WebMap, 
    view: MapView, 
    widgets: MapWidgets,
    zoomPre: () => void,
    zoomHome: () => void
} {
    // 1. Instanciamos el Web Map oficial
    const map = new WebMap({
        portalItem: { id: WEB_MAP_ID }
    });

    // 2. Leemos la URL por si el mapa fue "Compartido" con un extent especifico
    const urlParams = new URLSearchParams(window.location.search);
    const lonParam = urlParams.get("lon");
    const latParam = urlParams.get("lat");
    const zParam = urlParams.get("z");

    let initialCenter: number[] = [-74.08175, 4.60971];
    let initialZoom: number = 8;

    if (lonParam && latParam && zParam) {
        initialCenter = [parseFloat(lonParam), parseFloat(latParam)];
        initialZoom = parseFloat(zParam);
    }

    const view = new MapView({
        container: container,
        map: map,
        center: initialCenter,
        zoom: initialZoom,
        // Garantia estricta de que el mapa NO usa padding residual y se ajusta
        // dinamicamente al 100% del contenedor Flexbox, esencial en movil.
        ui: { components: ["attribution"] } 
    });

    // 3. Limpieza y creacion del buscador en el Header
    const searchContainer = document.getElementById("search-widget-container");
    if (searchContainer) searchContainer.innerHTML = "";
    new Search({ view: view, container: "search-widget-container" });
    
    // 4. Capas dedicadas para herramientas funcionales
    const graphicsLayer = new GraphicsLayer({ title: "Capa de Dibujo (Temporal)" });
    map.add(graphicsLayer);

    // 5. Creacion de widgets en memoria (SIN anadirlos a view.ui)
    const basemapGallery = new BasemapGallery({ view: view });
    const print = new Print({ view: view, printServiceUrl: PRINT_SERVICE_URL });
    const measurement = new Measurement({ view: view });
    const layerList = new LayerList({ view: view });
    const legend = new Legend({ view: view });
    const sketch = new Sketch({
        layer: graphicsLayer,
        view: view,
        creationMode: "update"
    });

    // Empaquetamos los widgets para enviarlos a React
    const widgets: MapWidgets = { layerList, legend, basemapGallery, print, measurement, sketch };

    // 6. Logica Robusta de Historial de Zoom (Zoom Pre)
    let extentHistory: Extent[] = [];
    let currentIndex = -1;
    let isNavigatingHistory = false;

    view.watch("stationary", (isStationary) => {
        if (isStationary) {
            if (!isNavigatingHistory) {
                const newExtent = view.extent.clone();
                extentHistory = extentHistory.slice(0, currentIndex + 1);
                extentHistory.push(newExtent);
                currentIndex++;
            }
            isNavigatingHistory = false;
        }
    });

    const zoomPre = () => {
        if (currentIndex > 0) {
            isNavigatingHistory = true;
            currentIndex--;
            view.goTo(extentHistory[currentIndex]);
        }
    };

    const zoomHome = () => {
        if (map.portalItem && map.portalItem.extent) {
            view.goTo(map.portalItem.extent);
        } else {
            view.goTo({ center: [-74.08175, 4.60971], zoom: 8 });
        }
    };

    return { map, view, widgets, zoomPre, zoomHome };
}

// Funcion para manejar GeoJSON local
export async function addLocalGeoJSON(map: WebMap, view: MapView, file: File) {
    const url = URL.createObjectURL(file);
    const layer = new GeoJSONLayer({
        url: url,
        title: `Importado: ${file.name}`
    });
    map.add(layer);
    layer.when(() => {
        if (isValidOperationalExtent(layer.fullExtent)) {
            view.goTo(layer.fullExtent);
        }
    });
}

function hasFiniteExtentCoordinates(extent: Extent): boolean {
    return [extent.xmin, extent.xmax, extent.ymin, extent.ymax].every(Number.isFinite);
}

function intersectsBounds(
    extent: Extent,
    bounds: { xmin: number; ymin: number; xmax: number; ymax: number }
): boolean {
    return extent.xmin <= bounds.xmax &&
        extent.xmax >= bounds.xmin &&
        extent.ymin <= bounds.ymax &&
        extent.ymax >= bounds.ymin;
}

function isGeographicExtent(extent: Extent): boolean {
    const wkid = extent.spatialReference?.wkid;
    return Boolean(extent.spatialReference?.isGeographic) ||
        wkid === 4326 ||
        (
            extent.xmin >= -180 &&
            extent.xmax <= 180 &&
            extent.ymin >= -90 &&
            extent.ymax <= 90
        );
}

function isWebMercatorExtent(extent: Extent): boolean {
    const wkid = extent.spatialReference?.wkid;
    return Boolean(extent.spatialReference?.isWebMercator) || wkid === 3857 || wkid === 102100 || wkid === 102113;
}

function isWorldLikeExtent(extent: Extent): boolean {
    const width = extent.width;
    const height = extent.height;

    if (isGeographicExtent(extent)) {
        return width >= WORLD_GEOGRAPHIC_WIDTH || height >= WORLD_GEOGRAPHIC_HEIGHT;
    }

    if (isWebMercatorExtent(extent)) {
        return width >= WORLD_WEB_MERCATOR_WIDTH || height >= WORLD_WEB_MERCATOR_HEIGHT;
    }

    return false;
}

function isOutsideExpectedScope(extent: Extent): boolean {
    if (isGeographicExtent(extent)) {
        return !intersectsBounds(extent, CUNDINAMARCA_GEOGRAPHIC_BOUNDS);
    }

    if (isWebMercatorExtent(extent)) {
        return !intersectsBounds(extent, CUNDINAMARCA_WEB_MERCATOR_BOUNDS);
    }

    return false;
}

export function isValidOperationalExtent(extent: Extent | null | undefined): extent is Extent {
    if (!extent) return false;
    if (!hasFiniteExtentCoordinates(extent)) return false;
    if (extent.width <= 0 || extent.height <= 0) return false;
    if (isWorldLikeExtent(extent)) return false;
    if (isOutsideExpectedScope(extent)) return false;

    return true;
}

function unionExtents(extents: Extent[]): Extent | null {
    if (extents.length === 0) return null;

    try {
        return extents.slice(1).reduce((accumulatedExtent, extent) => {
            return accumulatedExtent.union(extent) as Extent;
        }, extents[0].clone());
    } catch (error) {
        console.warn("No se pudo unir la extension de las subcapas. Se usara la primera extension valida.", error);
        return extents[0];
    }
}

async function getFeatureLayerExtent(layer: FeatureLayer): Promise<Extent | null> {
    try {
        await layer.when();
        const extentResponse = await layer.queryExtent();

        if (extentResponse && extentResponse.count > 0 && isValidOperationalExtent(extentResponse.extent)) {
            return extentResponse.extent;
        }
    } catch (error) {
        console.warn(`No se pudo calcular el extent exacto para la capa ${layer.title}.`, error);
    }

    return null;
}

async function getFeatureLayersExtent(layers: FeatureLayer[]): Promise<Extent | null> {
    const validExtents: Extent[] = [];

    for (const layer of layers) {
        const extent = await getFeatureLayerExtent(layer);
        if (extent) {
            validExtents.push(extent);
        }
    }

    return unionExtents(validExtents);
}

async function getVectorTileExtent(layer: VectorTileLayer): Promise<Extent | null> {
    try {
        await layer.when();
        return isValidOperationalExtent(layer.fullExtent) ? layer.fullExtent : null;
    } catch (error) {
        console.warn(`No se pudo validar el extent del Vector Tile ${layer.title}.`, error);
        return null;
    }
}

async function focusOnExtent(view: MapView, extent: Extent | null) {
    if (!isValidOperationalExtent(extent)) return;

    try {
        await view.goTo(extent);
    } catch (error) {
        console.warn("No se pudo enfocar la extension calculada.", error);
    }
}

// Logica para enfocar capas de catalogo: queryExtent para FeatureLayer y
// fullExtent validado estrictamente solo cuando no hay Feature Service disponible.
async function focusOnLayers(view: MapView, layers: FocusableCatalogLayer[]) {
    if (!layers || layers.length === 0) return;

    const featureLayers = layers.filter((layer): layer is FeatureLayer => layer.type === "feature");
    const featureExtent = await getFeatureLayersExtent(featureLayers);
    if (featureExtent) {
        await focusOnExtent(view, featureExtent);
        return;
    }

    const vectorLayers = layers.filter((layer): layer is VectorTileLayer => layer.type === "vector-tile");
    for (const layer of vectorLayers) {
        const vectorExtent = await getVectorTileExtent(layer);
        if (vectorExtent) {
            await focusOnExtent(view, vectorExtent);
            return;
        }
    }
}

async function createFeatureLayersFromService(item: ArcGISItem, groupId: string = item.id): Promise<FeatureLayer[]> {
    const serviceInfo = await esriRequest(item.url, { query: { f: "json" }, responseType: "json" });
    const serviceLayers = serviceInfo.data.layers as ServiceLayerInfo[] | undefined;

    if (serviceLayers && serviceLayers.length > 0) {
        return serviceLayers.map((layerInfo) => {
            const featureLayer = new FeatureLayer({
                url: `${item.url}/${layerInfo.id}`,
                title: layerInfo.name,
                id: `${item.id}_${layerInfo.id}`
            });
            (featureLayer as CatalogLayerWithGroup).groupId = groupId;
            return featureLayer;
        });
    }

    const singleLayer = new FeatureLayer({
        url: item.url,
        id: item.id,
        title: item.title
    });
    (singleLayer as CatalogLayerWithGroup).groupId = groupId;
    return [singleLayer];
}

async function getFeatureServiceExtent(item: ArcGISItem): Promise<Extent | null> {
    try {
        const layers = await createFeatureLayersFromService(item);
        return getFeatureLayersExtent(layers);
    } catch (error) {
        console.warn(`No se pudo calcular el extent del Feature Service ${item.title}.`, error);
        return null;
    }
}

async function addFeatureServiceToMap(map: WebMap, view: MapView, item: ArcGISItem, groupId: string = item.id) {
    try {
        const layersToAdd = await createFeatureLayersFromService(item, groupId);
        map.addMany([...layersToAdd].reverse());
        await focusOnLayers(view, layersToAdd);
    } catch (err) {
        console.error("Error al anadir la capa:", err);
    }
}

async function addVectorTileToMap(map: WebMap, view: MapView, item: ArcGISItem) {
    const vectorTileLayer = new VectorTileLayer({
        portalItem: { id: item.id },
        id: item.id,
        title: item.title
    });
    (vectorTileLayer as CatalogLayerWithGroup).groupId = item.id;

    try {
        map.add(vectorTileLayer);
        await vectorTileLayer.when();

        if (item.fallbackFeatureService) {
            const featureExtent = await getFeatureServiceExtent(item.fallbackFeatureService);
            await focusOnExtent(view, featureExtent);
            return;
        }

        await focusOnLayers(view, [vectorTileLayer]);
    } catch (err) {
        console.warn("No se pudo cargar el Vector Tile Service. Se intentara cargar el Feature Service asociado.", err);
        if (map.layers.includes(vectorTileLayer)) {
            map.remove(vectorTileLayer);
        }
        if (item.fallbackFeatureService) {
            await addFeatureServiceToMap(map, view, item.fallbackFeatureService, item.id);
            return;
        }
        console.error("No existe Feature Service de respaldo para el Vector Tile Service:", item.id);
    }
}

// Logica para anadir capas desde el catalogo al WebMap
export async function addLayerToMap(map: WebMap, view: MapView, item: ArcGISItem) {
    const existingLayersCollection = map.layers.filter(lyr => (lyr as CatalogLayerWithGroup).groupId === item.id);
    if (existingLayersCollection.length > 0) {
        if (item.type === "Vector Tile Service" && item.fallbackFeatureService) {
            const featureExtent = await getFeatureServiceExtent(item.fallbackFeatureService);
            await focusOnExtent(view, featureExtent);
            return;
        }

        const existingLayers = existingLayersCollection.toArray() as FocusableCatalogLayer[];
        await focusOnLayers(view, existingLayers);
        return;
    }

    if (item.type === "Vector Tile Service") {
        await addVectorTileToMap(map, view, item);
        return;
    }

    await addFeatureServiceToMap(map, view, item);
}
