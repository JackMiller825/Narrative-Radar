import { ensureWorkspace } from "../src/engine";

const ready = await ensureWorkspace();
console.log(`Seeded ${ready.user.email} in workspace ${ready.workspace.id} (${ready.workspace.mode}).`);
await import("../src/client").then(({ prisma }) => prisma.$disconnect());
