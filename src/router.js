const _ = require("lodash");
const Router = require("express").Router;
/**
 * express routing with main hull features
 */
module.exports = function router(minihull) {
  const hullRouter = new Router();
  hullRouter.get("/", (req, res) => {
    res.json({
      id: "minihull",
      name: "minihull",
      domain: minihull.getOrgAddr()
    });
  });

  hullRouter.get("/segments", (req, res) => {
    res.json(minihull.db.get("segments").value());
  });

  hullRouter.get("/app", (req, res) => {
    res.json(minihull.db.get("connectors").find({ id: req.header("Hull-App-Id") }).value());
  });

  hullRouter.put("/app", (req, res) => {
    minihull.db.get("connectors").find({ id: req.header("Hull-App-Id") }).set("private_settings", req.body.private_settings).write();
    res.json(minihull.db.get("connectors").find({ id: req.header("Hull-App-Id") }).value());
  });

  hullRouter.get("/:id", (req, res) => {
    const connector = minihull.db.get("connectors").find({ id: req.params.id }).value();
    const segment = minihull.db.get("segments").find({ id: req.params.id }).value();
    res.json(connector || segment);
  });

  hullRouter.put("/:id", (req, res) => {
    minihull.db.get("connectors").find({ id: req.header("Hull-App-Id") }).set("private_settings", req.body.private_settings).write();
    res.json(minihull.db.get("connectors").find({ id: req.params.id }));
  });

  hullRouter.post("/firehose", (req, res) => {
    res.end("ok");
  });

  hullRouter.post("/extract/user_reports", (req, res) => {
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

  return hullRouter;
};
