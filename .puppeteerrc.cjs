const { join } = require("path");

// Keep Puppeteer's downloaded Chrome inside the project folder, so hosts like
// Render that only ship the project directory from build to runtime still find it.
module.exports = {
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
};
