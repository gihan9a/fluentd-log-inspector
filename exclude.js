/**
 * Exclude common errors from log messages
 * Accepts regex patterns
 */
module.exports = [
  /Unauthorized/,
  /Unable to resolve the request ".*.(css|js).map"/,
  /The system is unable to find the requested action ".*.(css|js).map"./,
];
