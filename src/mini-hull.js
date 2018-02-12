const _ = require("lodash");
const Promise = require("bluebird");
const fs = require("fs");
const lodashId = require("lodash-id");
const MiniApplication = require("mini-application");
const crypto = require("crypto");
const faker = require("faker");
const shell = require("shelljs");

const minihullRouter = require("./router");

/**
 * A class build upon [MiniApplication](https://github.com/michaloo/mini-application) which allows to mimic [Hull Platform](https://hull.io) behavior.
 *
 * It comes with four different flavors of methods: "verb", `stub*`, `mimic*` and `fake*` methods:
 *
 * - "verb" methods - performs basic interactions between Hull and Connector,
 * they need to be supplied with all Connector information and don't rely on state other than external Connector.
 *
 * - `stub*` methods - stubs responses on specific endpoint of the MiniHull. Useful to stub state of the Platform end before
 * executing operations (see "verb" methods). Since they don't rely on internal state of MiniHull instance they
 * are most useful for integration tests.
 *
 * - `mimic*` methods - higher level methods to perform more complex operations, which base on internal
 * state (`db` param of the class) of the MiniHull instance. Most useful for interactive usage. See `fake*` methods
 * for complementary helpers.
 *
 * - `fake*` methods - to use `mimic*` methods we need internal state of MiniHull database (`db` param of the class).
 * To make the data seeding easier `fake*` methods provide an easy way of generating testing data.
 *
 * *Note:* Underscore methods `_*` are internal utilities and are not part of the public API of the library. Use with caution.
 *
 * @param {Object} options setup options
 * @param {string} options.secret secret used to sign requests to all installed connector instances (see `mimicInstall` method)
 */
class MiniHull extends MiniApplication {
  constructor(options = {}) {
    super();

    this.hostname = options.hostname || "localhost";
    this.overrideOrgAddr = options.overrideOrgAddr;
    this.secret = options.secret || "1234";

    // setup the internal db
    lodashId.createId = () => this.fakeId();
    this.db._.mixin(lodashId);
    this.db.defaults({ connectors: [], users: [], segments: [] }).write();

    // setup the express application
    this.app.use("/api/v1/", minihullRouter(this));
    this.app.get("/_batch", (req, res) => {
      res.end(this._getBatchBody());
    });
  }

  /*
   * --- Alias methods ---
   */

  users() {
    return this.db.get("users");
  }

  segments() {
    return this.db.get("segments");
  }

  connectors() {
    return this.db.get("connectors");
  }

  lastReq() {
    return requests.get("incoming").last();
  }

  /*
   * --- Verb methods ---
   */

  /**
   * Performs a basic POST request on connector instance.
   * Returns a [SuperAgent](https://github.com/visionmedia/superagent) instance,
   * remember to call `.then` to peform actual call.
   *
   * @public
   * @param  {string} id  Connector id
   * @param  {string} url Connector url (including path to the endpoint)
   * @return {superagent} SuperAgent instance
   */
  postConnector(id, url) {
    return this.post(url)
      .query({
        organization: this._getOrgAddr(),
        ship: id,
        secret: this.secret
      });
  }

  /**
   * Performs a special POST operation to the connector url
   *
   * @public
   * @param  {string} id  Connector id
   * @param  {string} url Connector url to batch endpoint
   * @return {superagent} SuperAgent instance
   */
  batchConnector(id, url) {
    return this.postConnector(id, url)
      .send({
        url: `http://${this._getOrgAddr()}/_batch`,
        format: "json"
      })
      .then((res) => res);
  }

  /**
   * Performs a SNS notification to selected connector
   *
   * @param  {string} id      Connector id
   * @param  {string} url     Connector url to notify endpoint
   * @param  {string} topic   Notification topic
   * @param  {Object} message Notification message
   * @return {superagent} SuperAgent instance
   */
  notifyConnector(id, url, topic, message) {
    const body = {
      Type: "Notification",
      Timestamp: new Date(),
      Subject: topic,
      Message: JSON.stringify(message)
    };

    return this.postConnector(id, url)
      .set("x-amz-sns-message-type", "dummy")
      .send(body)
      .then((res) => res);
  }

  /**
   * Performs a smart-notifier request to the connector
   *
   * @param  {Object} connector Connector object
   * @param  {string} url       Connector smart-notifier enabled endpoint
   * @param  {string} channel   Name of the notification channel
   * @param  {Array}  messages  Array of messages
   * @param  {Array}  segments  Array of segments
   * @return {superagent} SuperAgent instance
   */
  smartNotifyConnector(connector, url, channel, messages, segments = []) {
    const body = {
      notification_id: this.fakeId(),
      configuration: {
        id: connector.id,
        organization: this._getOrgAddr(),
        secret: this.secret
      },
      connector,
      segments,
      channel,
      messages
    };

    return this.post(url)
      .set("x-hull-smart-notifier", "dummy")
      .send(body)
      .then((res) => res);
  }

  /*
   * --- High level stubs ---
   */

  /**
   * Stubs MiniHull response on connector object
   *
   * @param  {Object} object Connector object
   * @return {this}   MiniHull instance
   */
  stubConnector(object) {
    this.stubApp(`/api/v1/${object.id}`).respond(object);
    this.stubApp("/api/v1/app").respond(object);
    return this;
  }

  /**
   * Stubs MiniHull response to segments endpoint
   *
   * @param  {Array} segments array of segments
   * @return {this}  MiniHull instance
   */
  stubSegments(segments) {
    this.stubApp("get", "/api/v1/segments").respond(segments);
    return this;
  }

  /**
   * Stub batch endpoint
   *
   * @param  {Array} objects Array of user objects
   * @return {this}  MiniHull instance
   */
  stubBatch(objects) {
    this.stubApp("get", "/_batch").respond(objects.map(o => JSON.stringify(o)).join("\n"));
    return this;
  }


  /*
   * --- Fake methods ---
   */

   /**
    * Generates fake ident used by MiniHull for connectors, users, segments
    *
    * @return {string} generated fake id
    */
  fakeId() {
    return crypto.randomBytes(12).toString("hex");
  }

  /**
   * Fakes basic user objects
   *
   * @param  {number} count Number of users to generate
   * @return {Array} Returns generated users
   */
  fakeUsers(count) {
    for (var i = 0; i < count; i++) {
      this.db.get("users").insert({
        first_name: faker.name.firstName(),
        last_name: faker.name.lastName(),
        email: faker.internet.email(),
        updated_at: faker.date.recent()
      }).write();
    }
    return this.db.get("users").value();
  }

  /**
   * Fake some segments
   *
   * @param  {number} count Number of segments to generate
   * @return {Array} Returns generated segments
   */
  fakeSegments(count) {
    const segments = ["Signed up", "Installed yesterday", "Prospects", "Leads", "Active", "Deals", "Demo requests", "Qualified Leads"];
    for (var i = 0; i < count; i++) {
      this.db.get("segments").insert({
        name: segments[Math.floor(Math.random() * segments.length)],
        created_at: faker.date.recent(),
        updated_at: faker.date.recent()
      }).write();
    }
    return this.db.get("segments").value();
  }

  /**
   * Radomly assing existing users to existing segments
   *
   * @return {Array} users array
   */
  fakeAssignment() {
    return this.db.get("users")
      .map((user) => {
        const count = faker.random.number({ max: this.db.get("segments").size() })
        for (var i = 0; i < count; i++) {
          user._segment_ids = _.uniq((user._segment_ids || [])
            .concat(faker.random.arrayElement(this.db.get("segments").value()).id));
        }
        return user;
      }).write();
  }

  // --- Mimic methods ---

  /**
   * Mimic the connector installation process
   *
   * @param  {string} connectorUrl Connector url to install from
   * @return {Promise}             Request promise
   */
  mimicInstall(connectorUrl) {
    return this.get(`${connectorUrl}/manifest.json`)
      .then(res => {
        return this.db.get("connectors").insert({
          _url: connectorUrl,
          manifest: res.body,
          private_settings: {}
        }).write();
      })
      .then((connector) => {
        return this.mimicSendNotification("ship:update", connector);
      });
  }

  /**
   * Opens a url to connector dashboard
   *
   * @param  {string} connectorId Optional connector id
   * @return {Object}             ShellJs response
   */
  mimicDashboard(connectorId) {
    const connector = connectorId
      ? this.db.get("connectors").find({ id: connectorId }).value()
      : this.db.get("connectors").get(0).value();

    if (!connector.manifest.admin) {
      return console.log("No dashboard available");
    }
    const url = this._getConnectorUrl(connector, connector.manifest.admin);
    return shell.exec(`open "${url}"`);
  }

  /**
   * Performs post call to the selected connector. If no connectorId is passed performs the call to the first installed.
   *
   * @param  {string} url         Connector endpoint url
   * @param  {string} connectorId Optional connector id
   * @return {Request}            Request promise
   */
  mimicPostConnector(url, connectorId) {
    const connector = connectorId
      ? this.db.get("connectors").find({ id: connectorId }).value()
      : this.db.get("connectors").get(0).value();

    return this.postConnector(connector.id, connector._url);
  }

  /**
   * Sends a notification to all installed connectors using the information from manifest.
   *
   * @param  {string} topic   Notification topic
   * @param  {Object} message Notification message
   * @return {Promise}        Request promise
   */
  mimicSendNotification(topic, message) {
    return Promise.all(this.db.get("connectors").reduce((acc, connector) => {
      _.map(connector.manifest.subscriptions, subscription => {
        acc.push(
          this.notifyConnector(connector.id, `${connector._url}${subscription.url}`, topic, message)
        );
      });
      return acc;
    }, []));
  }

  /**
   * Creates a UserReport object for selected user
   *
   * @param  {Object} ident Object to indentify user we want to sent (passed to lodash `find` function)
   * @return {Object}       Built `UserReport`
   */
  mimicUserReport(ident) {
    const user = this.get("users").find(ident).value();
    const segments = this._getMatchingSegments(user).value();
    return { user, segments, changes: {}, events: [] };
  }

  /**
   * Mimics a user enter segment event which will be sent using `mimicSendNotification` method.
   * Alters internal db.
   *
   * @param  {Object} ident     Object to indentify user we want to sent (passed to lodash `find` function)
   * @param  {string} segmentId Id of the segment user should "enter"
   * @return {Promise}          Request promise
   */
  mimicUserEntersSegment(ident, segmentId) {
    const user = this._findUser(ident);
    user._segment_ids = _.uniq((user._segment_ids || []).concat(segmentId));
    const segments = this._getMatchingSegments(user).value();
    const changes = {
      segments: {
        enter: this.segments().filter({ id: segmentId }).value()
      }
    };
    return this.mimicSendNotification("user_report:update", { user, segments, changes, events: []});
  }

  /**
   * Mimics a user left segment event which will be sent using `mimicSendNotification` method.
   * Alters internal db.
   *
   * @param  {Object} ident     Object to indentify user we want to sent (passed to lodash `find` function)
   * @param  {string} segmentId Id of the segment user should leave
   * @return {Promise}          Request promise
   */
  mimicUserExitsSegment(ident, segmentId) {
    const user = this._findUser(ident);
    _.remove(user._segment_ids, (sId) => sId == segmentId);
    const segments = this._getMatchingSegments(user).value();
    const changes = {
      segments: {
        left: this.segments().filter({ id: segmentId }).value()
      }
    };
    return this.mimicSendNotification("user_report:update", { user, segments, changes, events: []});
  }

  /**
   * Mimics an user:update event which will be sent using `mimicSendNotification` method.
   * Alters internal db.
   *
   * @param  {Object} ident  Object to indentify user we want to sent (passed to lodash `find` function)
   * @param  {Object} traits Target traits values
   * @return {Promise}       Request promise
   */
  mimicUpdateUser(ident, traits) {
    const user = this._findUser(ident);
    const changes = this._diff(user, traits);
    _.merge(user, traits);
    const segments = this._getMatchingSegments(user).value();
    return this.mimicSendNotification("user_report:update", { user, segments, changes, events: []});
  }

  /**
   * Mimics connector private settings update event
   *
   * @param  {Object} settings    New connector private settings
   * @param  {string} connectorId Optional connector id
   * @return {Promise}            Request promise
   */
  mimicUpdateConnector(settings, connectorId) {
    const connector = connectorId
      ? this.db.get("connectors").find({ id: connectorId }).value()
      : this.db.get("connectors").get(0).value();
    connector.private_settings = _.merge(connector.private_settings || {}, settings);
    return this.mimicSendNotification("ship:update", connector);
  }

  /**
   * Mimics an event when segment was altered.
   *
   * @param  {string} segmentName Segment name to sent
   * @param  {string} segmentId   Optional segment id
   * @return {Promise}            Request promise
   */
  mimicUpdateSegment(segmentName, segmentId) {
    const segment = segmentId
      ? this.db.get("segments").find({ id: segmentId }).value()
      : this.db.get("segments").get(0).value();
    segment.name = segmentName;
    return this.mimicSendNotification("segment:update", segment);
  }

  /**
   * Mimics a batch call to the connector
   *
   * @param  {string} connectorId Optional connector id
   * @return {Promise}            Request promise
   */
  mimicBatchCall(connectorId) {
    const connector = connectorId
      ? this.db.get("connectors").find({ id: connectorId }).value()
      : this.db.get("connectors").get(0).value();
    return this.batchConnector(connector.id, `${connector._url}/batch`);
  }

  /*
   * --- Utilities methods ---
   */

  _getOrgAddr() {
    if (this.overrideOrgAddr) {
      return this.overrideOrgAddr;
    }
    return `${this.hostname}:${this.port}`;
  }

  _getConnectorUrl(connector, url) {
    return `${connector._url}${url}?ship=${connector.id}&organization=${this._getOrgAddr()}&secret=${this.secret}`
  }

  _diff(objectA, objectB) {
    const diff = {};
    _.reduce(objectB, (acc, value, key) => {
      if (objectA[key] != value) {
        acc[key] = [objectA[key] || null, value];
      }
      return acc;
    }, diff);

    return diff;
  }

  _getMatchingSegments(user) {
    if (!user._segment_ids) {
      user = this._findUser(user);
    }
    const matchingSegments = this.db.get("segments")
      .intersectionBy((user._segment_ids || []).map(id => ({ id })), "id");
    return matchingSegments;
  }

  _getBatchBody() {
    const users = this.db.get("users").cloneDeep();
    return users.value().map(u => {
      u.segments_id = u._segment_ids;
      delete u._segment_ids;
      return JSON.stringify(u);
    }).join("\n");
  }

  _findUser(ident) {
    let findObject = ident;
    if (_.isString(ident)) {
      findObject = { id: ident };
    }
    return this.db.get("users").find(findObject).value();
  }
}

module.exports = MiniHull;
