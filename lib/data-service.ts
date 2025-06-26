import { prisma } from "./prisma";

// Example: Function to get a user by ID
export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function getCompanyByUserId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) return null;
  return prisma.company.findUnique({
    where: { id: user.companyId },
  });
}

export async function updateCompanyCsvUrl(companyId: string, csvUrl: string) {
  return prisma.company.update({
    where: { id: companyId },
    data: { csvUrl },
  });
}

export async function findUserByEmailWithCompany(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { company: true },
  });
}

export async function findSessionsByCompanyIdAndDateRange(companyId: string, startDate?: string, endDate?: string) {
  const whereClause: any = {
    companyId,
    processed: true,
  };

  if (startDate && endDate) {
    whereClause.startTime = {
      gte: new Date(startDate),
      lte: new Date(endDate + "T23:59:59.999Z"),
    };
  }

  return prisma.session.findMany({
    where: whereClause,
    include: {
      messages: true,
    },
  });
}

export async function getDistinctSessionCategories(companyId: string) {
  const categories = await prisma.session.findMany({
    where: {
      companyId,
      category: {
        not: null,
      },
    },
    distinct: ["category"],
    select: {
      category: true,
    },
    orderBy: {
      category: "asc",
    },
  });
  return categories.map((s) => s.category).filter(Boolean) as string[];
}

export async function getDistinctSessionLanguages(companyId: string) {
  const languages = await prisma.session.findMany({
    where: {
      companyId,
      language: {
        not: null,
      },
    },
    distinct: ["language"],
    select: {
      language: true,
    },
    orderBy: {
      language: "asc",
    },
  });
  return languages.map((s) => s.language).filter(Boolean) as string[];
}

export async function getSessionById(id: string) {
  return prisma.session.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function getFilteredAndPaginatedSessions(
  companyId: string,
  searchTerm: string | null,
  category: string | null,
  language: string | null,
  startDate: string | null,
  endDate: string | null,
  sortKey: string | null,
  sortOrder: string | null,
  page: number,
  pageSize: number
) {
  const whereClause: Prisma.SessionWhereInput = { companyId };

  // Search Term
  if (
    searchTerm &&
    typeof searchTerm === "string" &&
    searchTerm.trim() !== ""
  ) {
    const searchConditions = [
      { id: { contains: searchTerm } },
      { category: { contains: searchTerm } },
      { initialMsg: { contains: searchTerm } },
    ];
    whereClause.OR = searchConditions;
  }

  // Category Filter
  if (category && typeof category === "string" && category.trim() !== "") {
    whereClause.category = category;
  }

  // Language Filter
  if (language && typeof language === "string" && language.trim() !== "") {
    whereClause.language = language;
  }

  // Date Range Filter
  if (startDate && typeof startDate === "string") {
    whereClause.startTime = {
      ...((whereClause.startTime as object) || {}),
      gte: new Date(startDate),
    };
  }
  if (endDate && typeof endDate === "string") {
    const inclusiveEndDate = new Date(endDate);
    inclusiveEndDate.setDate(inclusiveEndDate.getDate() + 1);
    whereClause.startTime = {
      ...((whereClause.startTime as object) || {}),
      lt: inclusiveEndDate,
    };
  }

  // Sorting
  const validSortKeys: { [key: string]: string } = {
    startTime: "startTime",
    category: "category",
    language: "language",
    sentiment: "sentiment",
    messagesSent: "messagesSent",
    avgResponseTime: "avgResponseTime",
  };

  let orderByCondition:
    | Prisma.SessionOrderByWithRelationInput
    | Prisma.SessionOrderByWithRelationInput[];

  const primarySortField =
    sortKey && typeof sortKey === "string" && validSortKeys[sortKey]
      ? validSortKeys[sortKey]
      : "startTime"; // Default to startTime field if sortKey is invalid/missing

  const primarySortOrder =
    sortOrder === "asc" || sortOrder === "desc" ? sortOrder : "desc"; // Default to desc order

  if (primarySortField === "startTime") {
    // If sorting by startTime, it's the only sort criteria
    orderByCondition = { [primarySortField]: primarySortOrder };
  } else {
    // If sorting by another field, use startTime: "desc" as secondary sort
    orderByCondition = [
      { [primarySortField]: primarySortOrder },
      { startTime: "desc" },
    ];
  }

  return prisma.session.findMany({
    where: whereClause,
    orderBy: orderByCondition,
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
}

export async function countFilteredSessions(
  companyId: string,
  searchTerm: string | null,
  category: string | null,
  language: string | null,
  startDate: string | null,
  endDate: string | null
) {
  const whereClause: Prisma.SessionWhereInput = { companyId };

  // Search Term
  if (
    searchTerm &&
    typeof searchTerm === "string" &&
    searchTerm.trim() !== ""
  ) {
    const searchConditions = [
      { id: { contains: searchTerm } },
      { category: { contains: searchTerm } },
      { initialMsg: { contains: searchTerm } },
    ];
    whereClause.OR = searchConditions;
  }

  // Category Filter
  if (category && typeof category === "string" && category.trim() !== "") {
    whereClause.category = category;
  }

  // Language Filter
  if (language && typeof language === "string" && language.trim() !== "") {
    whereClause.language = language;
  }

  // Date Range Filter
  if (startDate && typeof startDate === "string") {
    whereClause.startTime = {
      ...((whereClause.startTime as object) || {}),
      gte: new Date(startDate),
    };
  }
  if (endDate && typeof endDate === "string") {
    const inclusiveEndDate = new Date(endDate);
    inclusiveEndDate.setDate(inclusiveEndDate.getDate() + 1);
    whereClause.startTime = {
      ...((whereClause.startTime as object) || {}),
      lt: inclusiveEndDate,
    };
  }

  return prisma.session.count({ where: whereClause });
}

export async function updateCompanySettings(
  companyId: string,
  data: {
    csvUrl?: string;
    csvUsername?: string;
    csvPassword?: string;
    sentimentAlert?: number | null;
  }
) {
  return prisma.company.update({
    where: { id: companyId },
    data,
  });
}

export async function getUsersByCompanyId(companyId: string) {
  return prisma.user.findMany({
    where: { companyId },
  });
}

export async function userExistsByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function createUser(email: string, passwordHash: string, companyId: string, role: string) {
  return prisma.user.create({
    data: {
      email,
      password: passwordHash,
      companyId,
      role,
    },
  });
}

export async function updateUserResetToken(email: string, token: string, expiry: Date) {
  return prisma.user.update({
    where: { email },
    data: { resetToken: token, resetTokenExpiry: expiry },
  });
}

export async function createCompany(name: string, csvUrl: string) {
  return prisma.company.create({
    data: { name, csvUrl },
  });
}

export async function findUserByResetToken(token: string) {
  return prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: { gte: new Date() },
    },
  });
}

export async function updateUserPasswordAndResetToken(userId: string, passwordHash: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      password: passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });
}

// Add more data fetching functions here as needed

import { Prisma } from "@prisma/client";

export async function getSessionByCompanyId(where: Prisma.SessionWhereInput) {
  return prisma.session.findFirst({
    orderBy: { createdAt: "desc" },
    where,
  });
}

export async function getCompanyById(companyId: string) {
  return prisma.company.findUnique({ where: { id: companyId } });
}
