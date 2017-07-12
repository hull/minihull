const _ = require("lodash");
const Promise = require("bluebird");
const fs = require("fs");
const lodashId = require("lodash-id");
const MiniApplication = require("mini-application");
const crypto = require("crypto");

const minihullRouter = require("./router");

/**
 * A class build upon Minibase which adds specific options related to the Hull platform.
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

  getOrgAddr() {
    if (this.overrideOrgAddr) {
      return this.overrideOrgAddr;
    }
    return `${this.hostname}:${this.port}`;
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
   * --- High level stubs ---
   */
  stubConnector(object) {
    this.stubGet(`/api/v1/${object.id}`).returnsJson(object);
    this.stubPut(`/api/v1/${object.id}`).returnsJson(object);

    this.stubGet("/api/v1/app").returnsJson(object);
    this.stubPut(`/api/v1/app`).returnsJson(object);
    return this;
  }

  stubSegments(segments) {
    this.stubGet("/api/v1/segments").returnsJson(segments);
    return this;
  }

  postConnector(id, url) {
    return this.post(url)
      .query({
        organization: this.getOrgAddr(),
        ship: id,
        secret: this.secret
      });
  }

  batchConnector(id, url) {
    return this.postConnector(id, url)
      .send({
        url: `http://${this.getOrgAddr()}/_batch`,
        format: "json"
      })
      .then((res) => res);
  }

  notifyConnector(id, url, topic, message) {
    const body = {
      Type: "Notification",
      Timestamp: new Date(),
      Subject: topic,
      Message: JSON.stringify(message)
    };

    return this.postConnector(id, url)
      .set("x-amz-sns-message-type", "dummy")
      .send(body);
  }

  /*
   * --- Fake methods ---
   */

  fakeId() {
    return crypto.randomBytes(12).toString('hex');
  }

  /**
   * Fakes basic user objects
   * @param  {Number} count
   * @return {Object}
   */
  fakeUsers(count) {
    const faker = this.faker;
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
   * @param  {Number} count
   * @return {Object}
   */
  fakeSegments(count) {
    const segments = ["Signed up", "Installed yesterday", "Prospects", "Leads", "Active", "Deals", "Demo requests", "Qualified Leads"];
    const faker = this.faker;
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
   */
  fakeAssignment() {
    return this.db.get("users")
      .map((user) => {
        const count = this.faker.random.number({ max: this.db.get("segments").size() })
        for (var i = 0; i < count; i++) {
          user._segment_ids = _.uniq((user._segment_ids || [])
            .concat(this.faker.random.arrayElement(this.db.get("segments").value()).id));
        }
        return user;
      }).write();
  }

  // --- Mimic methods ---

  /**
   * Mimic the connector installation process
   * @param  {String} connectorUrl
   * @return {Promise}
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
   * For interactive usage
   * @param  {String} connectorId
   * @return {[type]}        [description]
   */
  mimicDashboard(connectorId) {
    const connector = connectorId
      ? this.db.get("connectors").find({ id: connectorId }).value()
      : this.db.get("connectors").get(0).value();

    if (!connector.manifest.admin) {
      return console.log("No dashboard available");
    }
    const url = this._getConnectorUrl(connector, connector.manifest.admin);
    return this.shell.exec(`open "${url}"`);
  }

  /**
   * Performs post call to the selected connector. If no connectorId is passed performs the call to the first installed.
   *
   * @param  {String} url
   * @param  {String} connectorId
   * @return {Request}
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
   * @param  {String} topic
   * @param  {Object} message
   * @return {Promise}
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
   * creates
   * @param  {[type]} ident [description]
   * @return {[type]}       [description]
   */
  mimicUserReport(ident) {
    const user = this.get("users").find(ident).value();
    const segments = this._getMatchingSegments(user).value();
    return { user, segments, changes: {}, events: [] };
  }

  mimicUserEntersSegment(ident, segmentId) {
    const user = this._findUser(ident);
    user._segment_ids = _.unique((user._segment_ids || []).concat(segmentId));
    const segments = this._getMatchingSegments(user).value();
    return this.mimicSendNotification("user_report:update", { user, segments, changes: [], events: []});
  }

  mimicUserExitsSegment(ident, segmentId) {
    const user = this._findUser(ident);
    _.remove(user._segment_ids, (sId) => sId == segmentId);
    const segments = this._getMatchingSegments(user).value();
    return this.mimicSendNotification("user_report:update", { user, segments, changes: [], events: []});
  }

  mimicUpdateUser(ident, traits) {
    const user = this._findUser(ident);
    const changes = this._diff(user, traits);
    _.merge(user, traits);
    const segments = this._getMatchingSegments(user).value();
    return this.mimicSendNotification("user_report:update", { user, segments, changes, events: []});
  }

  mimicUpdateConnector(settings, connectorId) {
    const connector = connectorId
      ? this.db.get("connectors").find({ id: connectorId }).value()
      : this.db.get("connectors").get(0).value();
    connector.private_settings = _.merge(connector.private_settings || {}, settings);
    return this.mimicSendNotification("ship:update", connector);
  }

  mimicBatchCall(connectorId) {
    const connector = connectorId
      ? this.db.get("connectors").find({ id: connectorId }).value()
      : this.db.get("connectors").get(0).value();
    return this.batchConnector(connector.id, `${connector._url}/batch`);
  }

  // --- Utilities methods ---

  _getConnectorUrl(connector, url) {
    return `${connector._url}${url}?ship=${connector.id}&organization=${this.getOrgAddr()}&secret=${this.secret}`
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
    return this.db.get("users").find(ident).value();
  }
}

module.exports = MiniHull;
