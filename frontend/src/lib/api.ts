import axios from 'axios'

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '') + '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// 토큰을 사용하는 interceptor 제거

api.interceptors.response.use(
  (response) => {
    const d = response.data
    if (d && typeof d === 'object' && !Array.isArray(d) && Array.isArray(d.data)) {
      if (!('total' in d || 'totalPages' in d || 'page' in d || 'limit' in d)) {
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
