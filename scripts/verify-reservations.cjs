// Entry point for the reservation checks: stubs the `server-only` guard, then
// hands the TypeScript file to tsx in this same process.
require("./allow-server-modules.cjs");
require("tsx/cjs");
require("./verify-reservations.ts");
