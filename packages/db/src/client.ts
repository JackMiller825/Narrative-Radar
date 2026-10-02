import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function client() {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient();
  return globalForPrisma.prisma;
}

// Construct on first query so `next build` can typecheck and import this module
// before a hosted DATABASE_URL exists. Netlify injects that URL at runtime.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const current = client();
    const value = Reflect.get(current, property, receiver);
    return typeof value === "function" ? value.bind(current) : value;
  },
});
