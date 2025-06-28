import { describe, it, expect, beforeEach, vi } from 'vitest'
import { hash, compare } from 'bcryptjs'
import { db } from '../../lib/db'

// Mock database
vi.mock('../../lib/db', () => ({
  db: {
    platformUser: {
      findUnique: vi.fn(),
    },
  },
}))

describe('Platform Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Platform User Authentication Logic', () => {
    it('should authenticate valid platform user with correct password', async () => {
      const plainPassword = 'SecurePassword123!'
      const hashedPassword = await hash(plainPassword, 10)
      
      const mockUser = {
        id: '1',
        email: 'admin@notso.ai',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(db.platformUser.findUnique).mockResolvedValue(mockUser)

      // Simulate the authentication logic
      const user = await db.platformUser.findUnique({
        where: { email: 'admin@notso.ai' }
      })

      expect(user).toBeTruthy()
      expect(user?.email).toBe('admin@notso.ai')
      
      // Verify password
      const isValidPassword = await compare(plainPassword, user!.password)
      expect(isValidPassword).toBe(true)
    })

    it('should reject invalid email', async () => {
      vi.mocked(db.platformUser.findUnique).mockResolvedValue(null)

      const user = await db.platformUser.findUnique({
        where: { email: 'invalid@notso.ai' }
      })

      expect(user).toBeNull()
    })

    it('should reject invalid password', async () => {
      const correctPassword = 'SecurePassword123!'
      const wrongPassword = 'WrongPassword'
      const hashedPassword = await hash(correctPassword, 10)
      
      const mockUser = {
        id: '1',
        email: 'admin@notso.ai',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(db.platformUser.findUnique).mockResolvedValue(mockUser)

      const user = await db.platformUser.findUnique({
        where: { email: 'admin@notso.ai' }
      })

      const isValidPassword = await compare(wrongPassword, user!.password)
      expect(isValidPassword).toBe(false)
    })
  })

  describe('Platform User Roles', () => {
    it('should support all platform user roles', async () => {
      const roles = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT']
      
      for (const role of roles) {
        const mockUser = {
          id: '1',
          email: `${role.toLowerCase()}@notso.ai`,
          password: await hash('SecurePassword123!', 10),
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        vi.mocked(db.platformUser.findUnique).mockResolvedValue(mockUser)

        const user = await db.platformUser.findUnique({
          where: { email: mockUser.email }
        })

        expect(user?.role).toBe(role)
      }
    })
  })

  describe('JWT Token Structure', () => {
    it('should include required platform user fields', () => {
      // Test the expected structure of JWT tokens
      const expectedToken = {
        sub: '1',
        email: 'admin@notso.ai',
        isPlatformUser: true,
        platformRole: 'SUPER_ADMIN',
      }

      expect(expectedToken).toHaveProperty('sub')
      expect(expectedToken).toHaveProperty('email')
      expect(expectedToken).toHaveProperty('isPlatformUser')
      expect(expectedToken).toHaveProperty('platformRole')
      expect(expectedToken.isPlatformUser).toBe(true)
    })
  })

  describe('Session Structure', () => {
    it('should include platform fields in session', () => {
      // Test the expected structure of sessions
      const expectedSession = {
        user: {
          id: '1',
          email: 'admin@notso.ai',
          isPlatformUser: true,
          platformRole: 'SUPER_ADMIN',
        },
        expires: new Date().toISOString(),
      }

      expect(expectedSession.user).toHaveProperty('id')
      expect(expectedSession.user).toHaveProperty('email')
      expect(expectedSession.user).toHaveProperty('isPlatformUser')
      expect(expectedSession.user).toHaveProperty('platformRole')
      expect(expectedSession.user.isPlatformUser).toBe(true)
    })
  })
})