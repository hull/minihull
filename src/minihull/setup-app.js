const _ = require("lodash");
const Router = require("express").Router;
/**
 * express routing with main hull features
 */
module.exports = function setupApp(minihull) {
  const hullRouter = new Router();
  hullRouter.get("/", (req, res) => {
    res.json({
      id: "minihull",
      name: "minihull",
      domain: "localhost:3000"
    });
  });

  hullRouter.get("/segments", (req, res) => {
    res.json(minihull.db.get("segments").value());
  });

  hullRouter.get("/:id", (req, res) => {
    res.json(minihull.db.get("ships").find({ id: req.params.id }).value());
  });

  hullRouter.get("/app", (req, res) => {
    res.json(minihull.db.get("ships").find({ id: req.header("Hull-App-Id") }).value());
  });

  hullRouter.post("/firehose", (req, res) => {
    res.end("ok");
  });

  hullRouter.get("/search/user_reports/bootstrap", (req, res) => {
    res.json({
      tree: [{
        text: "User",
        children: [
          { id: 'id', text: 'Hull ID', type: 'string' },
          { id: 'email', text: 'Email', type: 'string', default: null }
        ]
      }]
    });
  });

  minihull.app.use("/api/v1/", hullRouter);


  // minihull helpers
  const minihullRouter = new Router();

  minihullRouter.get("/_install", (req, res) => {
    const result = minihull.install();
    res.json(result);
  });

  minihullRouter.get("/_dashboard", (req, res) => {
    res.json({ to: "implement" });
  });

  minihullRouter.get("/_uninstall", (req, res) => {
    res.json({ to: "implement" });
  });

  minihullRouter.get("/_batch", (req, res) => {
    res.end(minihull.batch(req.query.users.split(",")));
  });

  minihullRouter.get("/_batch-all", (req, res) => {
    res.end(minihull.batchAll());
  });
  minihull.app.use("/", minihullRouter);

  return minihull;
};
