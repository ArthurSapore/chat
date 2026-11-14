export const API_URL = import.meta.env.VITE_API_URL as string

if (import.meta.env.DEV) {
  console.warn("Running development enviroment")
}

export const httpConfig = {
  baseURL: API_URL,
  withCredentials: true,
}
