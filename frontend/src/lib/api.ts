import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    const d = response.data
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      const keys = Object.keys(d)
      if (keys.length === 1 && keys[0] === 'data' && Array.isArray(d.data)) {
        response.data = d.data
      }
    }
    return response
  },
  (error) => {
    return Promise.reject(error)
  }
)

export default api
