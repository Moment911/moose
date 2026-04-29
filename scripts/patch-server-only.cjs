// Register hook: redirect 'server-only' to an empty module
const Module = require('module')
const orig = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'server-only') {
    return require.resolve('./noop.js')
  }
  return orig.call(this, request, parent, isMain, options)
}
