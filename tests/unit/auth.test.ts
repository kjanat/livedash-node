import { describe, it, expect, vi, beforeEach } from "vitest";
import { authOptions } from "../../app/api/auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Mock PrismaClient
vi.mock("../../lib/prisma", () => ({
  prisma: new PrismaClient(),
}));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
  },
}));

describe("NextAuth Credentials Provider authorize function", () => {
  let mockFindUnique: vi.Mock;
  let mockBcryptCompare: vi.Mock;

  beforeEach(() => {
    mockFindUnique = vi.fn();
    // @ts-ignore
    prisma.user.findUnique = mockFindUnique;
    mockBcryptCompare = bcrypt.compare as vi.Mock;
    vi.clearAllMocks();
  });

  const authorize = authOptions.providers[0].authorize;

  it("should return null if email or password are not provided", async () => {
    // @ts-ignore
    const result1 = await authorize({
      email: "test@example.com",
      password: "",
    });
    expect(result1).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();

    // @ts-ignore
    const result2 = await authorize({ email: "", password: "password" });
    expect(result2).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("should return null if user is not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    // @ts-ignore
    const result = await authorize({
      email: "nonexistent@example.com",
      password: "password",
    });
    expect(result).toBeNull();
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "nonexistent@example.com" },
    });
    expect(mockBcryptCompare).not.toHaveBeenCalled();
  });

  it("should return null if password does not match", async () => {
    const mockUser = {
      id: "user123",
      email: "test@example.com",
      password: "hashed_password",
      companyId: "company123",
      role: "USER",
    };
    mockFindUnique.mockResolvedValue(mockUser);
    mockBcryptCompare.mockResolvedValue(false);

    // @ts-ignore
    const result = await authorize({
      email: "test@example.com",
      password: "wrong_password",
    });
    expect(result).toBeNull();
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
    });
    expect(mockBcryptCompare).toHaveBeenCalledWith(
      "wrong_password",
      "hashed_password"
    );
  });

  it("should return user object if credentials are valid", async () => {
    const mockUser = {
      id: "user123",
      email: "test@example.com",
      password: "hashed_password",
      companyId: "company123",
      role: "USER",
    };
    mockFindUnique.mockResolvedValue(mockUser);
    mockBcryptCompare.mockResolvedValue(true);

    // @ts-ignore
    const result = await authorize({
      email: "test@example.com",
      password: "correct_password",
    });
    expect(result).toEqual({
      id: "user123",
      email: "test@example.com",
      companyId: "company123",
      role: "USER",
    });
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
    });
    expect(mockBcryptCompare).toHaveBeenCalledWith(
      "correct_password",
      "hashed_password"
    );
  });
});
