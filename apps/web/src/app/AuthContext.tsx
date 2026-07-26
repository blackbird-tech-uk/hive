import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import {
  clearAuthSession,
  getCurrentUser,
  getOrganizations,
  loginUser,
  restoreAuthSession,
  saveAuthSession,
} from '../lib/api'
import type {
  AuthenticatedUser,
  Organization,
} from '../lib/api'

type AuthContextValue = {
  user: AuthenticatedUser | null
  organizations: Organization[]
  activeOrganization: Organization | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (
    username: string,
    password: string,
  ) => Promise<void>
  logout: () => void
  setActiveOrganization: (
    organization: Organization,
  ) => void
}

const AuthContext = createContext<
  AuthContextValue | undefined
>(undefined)

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<AuthenticatedUser | null>(null)

  const [organizations, setOrganizations] = useState<
    Organization[]
  >([])

  const [
    activeOrganization,
    setActiveOrganizationState,
  ] = useState<Organization | null>(null)

  const [isLoading, setIsLoading] = useState(true)

  const loadAuthenticatedSession =
    useCallback(async () => {
      const session = restoreAuthSession()

      if (!session.accessToken) {
        setIsLoading(false)
        return
      }

      try {
        const [currentUser, availableOrganizations] =
          await Promise.all([
            getCurrentUser(),
            getOrganizations(),
          ])

        setUser(currentUser)
        setOrganizations(availableOrganizations)

        const storedOrganization =
          availableOrganizations.find(
            (organization) =>
              organization.id ===
              session.organizationId,
          )

        const organization =
          storedOrganization ??
          availableOrganizations[0] ??
          null

        setActiveOrganizationState(organization)

        if (organization) {
          saveAuthSession({
            accessToken: session.accessToken,
            organizationId: organization.id,
          })
        }
      } catch {
        clearAuthSession()
        setUser(null)
        setOrganizations([])
        setActiveOrganizationState(null)
      } finally {
        setIsLoading(false)
      }
    }, [])

  useEffect(() => {
    void loadAuthenticatedSession()
  }, [loadAuthenticatedSession])

  const login = useCallback(
    async (
      username: string,
      password: string,
    ) => {
      const tokenResponse = await loginUser(
        username,
        password,
      )

      saveAuthSession({
        accessToken: tokenResponse.access_token,
        organizationId: null,
      })

      try {
        const [currentUser, availableOrganizations] =
          await Promise.all([
            getCurrentUser(),
            getOrganizations(),
          ])

        const organization =
          availableOrganizations[0] ?? null

        setUser(currentUser)
        setOrganizations(availableOrganizations)
        setActiveOrganizationState(organization)

        saveAuthSession({
          accessToken: tokenResponse.access_token,
          organizationId:
            organization?.id ?? null,
        })
      } catch (error) {
        clearAuthSession()
        throw error
      }
    },
    [],
  )

  const logout = useCallback(() => {
    clearAuthSession()
    setUser(null)
    setOrganizations([])
    setActiveOrganizationState(null)
  }, [])

  const setActiveOrganization = useCallback(
    (organization: Organization) => {
      setActiveOrganizationState(organization)

      const session = restoreAuthSession()

      if (session.accessToken) {
        saveAuthSession({
          accessToken: session.accessToken,
          organizationId: organization.id,
        })
      }
    },
    [],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      organizations,
      activeOrganization,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
      setActiveOrganization,
    }),
    [
      user,
      organizations,
      activeOrganization,
      isLoading,
      login,
      logout,
      setActiveOrganization,
    ],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider.',
    )
  }

  return context
}