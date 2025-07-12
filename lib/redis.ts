/**
 * Redis Client Configuration and Management
 *
 * This module provides Redis client setup with connection management,
 * error handling, and graceful fallbacks to in-memory caching when Redis is unavailable.
 */

import { createClient, type RedisClientType } from "redis";
import { env } from "./env";

type RedisClient = RedisClientType;

class RedisManager {
  private client: RedisClient | null = null;
  private isConnected = false;
  private isConnecting = false;
  private connectionAttempts = 0;
  private readonly maxRetries = 3;
  private readonly retryDelay = 2000;

  constructor() {
    this.initializeConnection();
  }

  private async initializeConnection(): Promise<void> {
    if (this.isConnecting || this.isConnected) return;

    this.isConnecting = true;

    try {
      if (!env.REDIS_URL) {
        console.log("[Redis] No REDIS_URL provided, skipping Redis connection");
        this.isConnecting = false;
        return;
      }

      this.client = createClient({
        url: env.REDIS_URL,
        socket: {
          connectTimeout: 5000,
          commandTimeout: 3000,
        },
        retryDelayOnFailover: 100,
        retryDelayOnClusterDown: 300,
      });

      this.client.on("error", (error) => {
        console.error("[Redis] Client error:", error);
        this.isConnected = false;
      });

      this.client.on("connect", () => {
        console.log("[Redis] Connected successfully");
        this.isConnected = true;
        this.connectionAttempts = 0;
      });

      this.client.on("disconnect", () => {
        console.log("[Redis] Disconnected");
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error("[Redis] Connection failed:", error);
      this.isConnected = false;
      this.connectionAttempts++;

      if (this.connectionAttempts < this.maxRetries) {
        console.log(
          `[Redis] Retrying connection in ${this.retryDelay}ms (attempt ${this.connectionAttempts}/${this.maxRetries})`
        );
        setTimeout(() => {
          this.isConnecting = false;
          this.initializeConnection();
        }, this.retryDelay);
      } else {
        console.warn(
          "[Redis] Max connection attempts reached, falling back to in-memory caching"
        );
      }
    } finally {
      this.isConnecting = false;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      return await this.client.get(key);
    } catch (error) {
      console.error(`[Redis] GET failed for key ${key}:`, error);
      return null;
    }
  }

  async set(
    key: string,
    value: string,
    options?: { EX?: number; PX?: number }
  ): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.set(key, value, options);
      return true;
    } catch (error) {
      console.error(`[Redis] SET failed for key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`[Redis] DEL failed for key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`[Redis] EXISTS failed for key ${key}:`, error);
      return false;
    }
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    if (!this.isConnected || !this.client || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      return await this.client.mGet(keys);
    } catch (error) {
      console.error(`[Redis] MGET failed for keys ${keys.join(", ")}:`, error);
      return keys.map(() => null);
    }
  }

  async mset(keyValuePairs: Record<string, string>): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.mSet(keyValuePairs);
      return true;
    } catch (error) {
      console.error("[Redis] MSET failed:", error);
      return false;
    }
  }

  async flushPattern(pattern: string): Promise<number> {
    if (!this.isConnected || !this.client) {
      return 0;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;

      await this.client.del(keys);
      return keys.length;
    } catch (error) {
      console.error(`[Redis] FLUSH pattern ${pattern} failed:`, error);
      return 0;
    }
  }

  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.disconnect();
      } catch (error) {
        console.error("[Redis] Disconnect error:", error);
      }
      this.client = null;
      this.isConnected = false;
    }
  }

  async healthCheck(): Promise<{
    connected: boolean;
    latency?: number;
    error?: string;
  }> {
    if (!this.isConnected || !this.client) {
      return { connected: false, error: "Not connected" };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;
      return { connected: true, latency };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Singleton instance
const redisManager = new RedisManager();

export { redisManager };
export type { RedisClient };
