import axios from 'axios'

const apiHost = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:3000' : '')

const api = axios.create({
  baseURL: `${apiHost}/api`,
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
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
    return Promise.reject(error)
  }
)

export default api
