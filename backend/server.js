// Local backend server: the same API that runs on Cloud Functions, served by
// Node for development, tests, or any Node host.
//
//   npm start         (reads backend/.env.local, then backend/.env)

import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

// .env.local is for this local server only; `firebase deploy` never uploads it.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(fileURLToPath(new URL(file, import.meta.url)));
  } catch {
    // optional
  }
}

const { handle } = await import("./app.js");
const PORT = Number(process.env.PORT) || 8000;

const server = createServer(handle);
server.listen(PORT, () => {
  console.log(`TripMate backend running on http://localhost:${PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
