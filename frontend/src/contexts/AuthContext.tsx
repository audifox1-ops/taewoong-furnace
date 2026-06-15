import { createContext, useContext, ReactNode } from 'react'

interface User {
  id: number
  username: string
  role: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAdmin: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // 항상 로그인된 더미 관리자 상태 반환
  const dummyUser: User = { id: 1, username: 'admin', role: 'admin' }
  const dummyToken = 'dummy-token'

  const login = async () => {}
  const logout = () => {}

  return (
    <AuthContext.Provider value={{ 
      user: dummyUser, 
      token: dummyToken, 
      login, 
      logout, 
      isAdmin: true, 
      isLoading: false 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
