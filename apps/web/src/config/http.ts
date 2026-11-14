export const API_URL = import.meta.env.VITE_API_URL as string

export const httpConfig = {
  baseURL: API_URL,
  withCredentials: true,
}
