// Variables de entorno o valores por defecto
export const GROUP_ID = import.meta.env.VITE_GROUP_ID || "244695359f1d45c4862ed0508d64a335";
export const PORTAL_URL = import.meta.env.VITE_ARCGIS_PORTAL_URL || "https://www.arcgis.com";

// URL para construir la consulta de búsqueda en el grupo
export const SEARCH_QUERY_URL = `${PORTAL_URL}/sharing/rest/search?q=(type:"Feature Service" OR type:"File Geodatabase") AND group:${GROUP_ID}&f=json&num=100`;

// URL base para el portal de Open Data donde se descargan las GDBs
export const OPEN_DATA_URL_BASE = "https://mapasyestadisticas-cundinamarca-map.opendata.arcgis.com/datasets/";

// Servicio de impresión estándar
export const PRINT_SERVICE_URL = "https://utility.arcgisonline.com/arcgis/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task";