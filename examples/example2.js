import Minihull from "minihull";
import { Connector } from "hull";

import Minihubspot from "./minihubspot";
import server from "../server/server";
import worker from "../server/worker";

const minihull = new Minihull();
const minihubspot = new Minihubspot();

const app = express();
const connector = new Connector({ hostSecret: 1234, port: 8000 });
connector.setupApp(app);
server(app, { queue: connector.queue });
worker(connector);

beforeEach(() => {
  minihull.listen(8001);
  minihull.install("http://localhost:8000/");
  minihull.updateFirstShip({
    // private_settings
  });
  minihubspot.listen(8002);
  connector.startApp(app);
  connector.startWorker();
});

it("should fetch all users from hubspot", (done) => {
  minihubspot.fakeUsers(10);
  minihull.callFirstShip("/fetch-all");

  minihull.on("request.firehose")
    .then(() => {
      const lastHubspotReq = minihubspot.lastReq();
      const hullFirehose = minihull.lastFirehose();
      expect(lastHubspotReq.path).to.be.equal("/contacts/v1/lists/all/contacts/all")
      expect(lastHubspotReq.query).to.be.eql({
        count: 100,
        vidOffset: 0,
        property:
      });

      expect(hullFirehose.type).to.be.equal("traits");
      expect(hullFirehose.payload.email).to.be.equal(minihubspot.db.get("users").get(0).email);
      done();
    });
});

afterEach(() => {
  minihull.resetState();
  minihull.close();
  minihubspot.resetState();
  minihubspot.close();
  connector.stopApp(app);
  connector.stopWorker();
});
