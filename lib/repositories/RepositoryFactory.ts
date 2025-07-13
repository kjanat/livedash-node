import { SecurityAuditLogRepository } from "./SecurityAuditLogRepository";
import { SessionRepository } from "./SessionRepository";
import { UserRepository } from "./UserRepository";

/**
 * Repository factory for centralized repository management
 * Implements singleton pattern to ensure single instances
 */
export class RepositoryFactory {
  private static instance: RepositoryFactory;

  private sessionRepository?: SessionRepository;
  private userRepository?: UserRepository;
  private securityAuditLogRepository?: SecurityAuditLogRepository;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance of RepositoryFactory
   */
  static getInstance(): RepositoryFactory {
    if (!RepositoryFactory.instance) {
      RepositoryFactory.instance = new RepositoryFactory();
    }
    return RepositoryFactory.instance;
  }

  /**
   * Get SessionRepository instance
   */
  getSessionRepository(): SessionRepository {
    if (!this.sessionRepository) {
      this.sessionRepository = new SessionRepository();
    }
    return this.sessionRepository;
  }

  /**
   * Get UserRepository instance
   */
  getUserRepository(): UserRepository {
    if (!this.userRepository) {
      this.userRepository = new UserRepository();
    }
    return this.userRepository;
  }

  /**
   * Get SecurityAuditLogRepository instance
   */
  getSecurityAuditLogRepository(): SecurityAuditLogRepository {
    if (!this.securityAuditLogRepository) {
      this.securityAuditLogRepository = new SecurityAuditLogRepository();
    }
    return this.securityAuditLogRepository;
  }

  /**
   * Get all repository instances
   */
  getAllRepositories() {
    return {
      sessions: this.getSessionRepository(),
      users: this.getUserRepository(),
      securityAuditLogs: this.getSecurityAuditLogRepository(),
    };
  }

  /**
   * Reset all repository instances (useful for testing)
   */
  reset(): void {
    this.sessionRepository = undefined;
    this.userRepository = undefined;
    this.securityAuditLogRepository = undefined;
  }
}

/**
 * Convenience function to get repository factory instance
 */
export const repositories = RepositoryFactory.getInstance();

/**
 * Convenience functions to get specific repositories
 */
export const getSessionRepository = () => repositories.getSessionRepository();
export const getUserRepository = () => repositories.getUserRepository();
export const getSecurityAuditLogRepository = () =>
  repositories.getSecurityAuditLogRepository();
