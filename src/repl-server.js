const repl = require("repl");
const vm = require("vm");

module.exports = function ReplServer(prompt) {
  const replServer = repl.start({
    prompt: prompt,
    useColors: true,
    eval: function(cmd, context, filename, callback) {
      var result = vm.runInContext(cmd, context);

      if (result && result.write instanceof Function && result.__wrapped__) {
        return callback(null, result.write());
      }

      if (result && result.then instanceof Function) {
        return result.then(function(res) {
          callback(null, res)
        }, function(err) {
          callback(null, err)
        });
      }
      callback(null, result);
    }
  });
  return replServer;
};
