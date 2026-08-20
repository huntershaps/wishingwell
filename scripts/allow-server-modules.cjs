// The `server-only` guard is there to stop server code reaching a browser
// bundle. These verification scripts are the server, so the guard is stubbed
// out for the length of the run.
const Module = require("node:module");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return require.resolve("./server-only-stub.cjs");
  return resolve.call(this, request, ...rest);
};
