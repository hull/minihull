const _ = require("lodash");
const lodashId = require("lodash-id");

module.exports = function setupDb(minihull) {
  lodashId.createId = () => require('crypto').randomBytes(12).toString('hex');
  minihull.db._.mixin(lodashId);

  minihull.db.defaults({ ships: [], users: [], segments: [] }).write();
  return minihull;
};
