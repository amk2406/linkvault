const { uuid } = require('./random');

// Prefixed, human-readable user ID: usr_<uuid>
module.exports = function userId() {
  return `usr_${uuid()}`;
};