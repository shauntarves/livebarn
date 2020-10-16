/**
 * External dependencies
 */
const fs = require("fs");
const path = require("path");
const url = require("url");

const chunk = (array, size) => {
  if (!array) return [];
  const firstChunk = array.slice(0, size); // create the first chunk of the given array
  if (!firstChunk.length) {
    return array; // this is the base case to terminate the recursive
  }
  return [firstChunk].concat(chunk(array.slice(size, array.length), size));
};
// this function turns a single array into an array of arrays, each containing no more than _size_ elements
exports.chunk = chunk;

exports.getPathForUri = (uri) => {
  if (!uri) {
    return;
  }
  return path.parse(url.parse(uri).pathname);
};

exports.getFilenameForUri = (uri) => {
  if (!uri) {
    return;
  }
  return path.basename(url.parse(uri).pathname);
};

exports.createDirectory = (path) => {
  if (!fs.existsSync(path)) {
    fs.mkdir(path, (err) => {
      if (err) {
        throw err;
      }
    });
  }
  return path;
};

// find all URLs in a multi-line string
exports.matchUrls = (content) => {
  return content.match(new RegExp("https?://[^\\s]+", "g"));
};
