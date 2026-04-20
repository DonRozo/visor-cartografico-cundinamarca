/// <reference types="vite/client" />

// Define los tipos para las variables de entorno de tu proyecto
interface ImportMetaEnv {
  readonly VITE_ARCGIS_PORTAL_URL: string;
  readonly VITE_GROUP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}