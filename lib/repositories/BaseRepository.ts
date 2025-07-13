/**
 * Base repository interface with common CRUD operations
 */
export interface BaseRepository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  findMany(options?: FindManyOptions<T>): Promise<T[]>;
  create(data: CreateInput<T>): Promise<T>;
  update(id: ID, data: UpdateInput<T>): Promise<T | null>;
  delete(id: ID): Promise<boolean>;
  count(options?: CountOptions<T>): Promise<number>;
}

/**
 * Generic find options interface
 */
export interface FindManyOptions<T> {
  where?: Partial<T>;
  orderBy?: Record<keyof T, "asc" | "desc">;
  skip?: number;
  take?: number;
  include?: Record<string, boolean>;
}

/**
 * Generic count options interface
 */
export interface CountOptions<T> {
  where?: Partial<T>;
}

/**
 * Create input type - excludes auto-generated fields
 */
export type CreateInput<T> = Omit<T, "id" | "createdAt" | "updatedAt">;

/**
 * Update input type - excludes auto-generated fields and makes all optional
 */
export type UpdateInput<T> = Partial<Omit<T, "id" | "createdAt" | "updatedAt">>;

/**
 * Repository error types
 */
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

export class NotFoundError extends RepositoryError {
  constructor(entity: string, id: string | number) {
    super(`${entity} with id ${id} not found`, "NOT_FOUND");
  }
}

export class ConflictError extends RepositoryError {
  constructor(message: string, cause?: Error) {
    super(message, "CONFLICT", cause);
  }
}

export class ValidationError extends RepositoryError {
  constructor(message: string, cause?: Error) {
    super(message, "VALIDATION_ERROR", cause);
  }
}
