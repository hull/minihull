const _ = require("lodash");
const Promise = require("bluebird");
const fs = require("fs");

const Minibase = require("./minibase");
const setupDb = require("./minihull/setup-db");
const setupApp = require("./minihull/setup-app");

class Minihull extends Minibase {
  constructor(options = {}) {
    super(options);
    setupDb(this);
    setupApp(this);
    this.hostname = options.hostname || "localhost";
    this.publicAddr = options.publicAddr;
  }

  getOrgAddr() {
    if (this.publicAddr) {
      return this.publicAddr;
    }
    return `${this.hostname}:${this.port}`;
  }

  users() {
    return this.db.get("users");
  }

  segments() {
    return this.db.get("segments");
  }

  ships() {
    return this.db.get("ships");
  }

  lastReq() {
    return requests.get("incoming").last();
  }

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

  buildUserReport(ident) {
    const user = this.get("users").find(ident).value();
    const segments = this.getMatchingSegments(user).value();
    return { user, segments, changes: {}, events: [] };
  }

  findUser(ident) {
    let findObject = ident;
    if (_.isString(ident)) {
      findObject = { id: ident };
    }
    return this.db.get("users").find(ident).value();
  }

  addUserToSegment(ident, segmentId) {
    const user = this.findUser(ident);
    user._segment_ids = _.unique((user._segment_ids || []).concat(segmentId));
    const segments = this.getMatchingSegments(user).value();
    return this.sendNotification("user_report:update", { user, segments, changes: [], events: []});
  }

  removeUserFromSegment(ident, segmentId) {
    const user = this.findUser(ident);
    _.remove(user._segment_ids, (sId) => sId == segmentId);
    const segments = this.getMatchingSegments(user).value();
    return this.sendNotification("user_report:update", { user, segments, changes: [], events: []});
  }

  updateUser(ident, traits) {
    const user = this.findUser(ident);
    const changes = this.diff(user, traits);
    _.merge(user, traits);
    const segments = this.getMatchingSegments(user).value();
    return this.sendNotification("user_report:update", { user, segments, changes, events: []});
  }

  callFirstShip(url) {
    const ship = this.db.get("ships").get(0).value();
    return this.post(`${ship.url}${url}?ship=${ship.id}&organization=${this.getOrgAddr()}&secret=1234`);
  }

  updateFirstShip(settings) {
    const shipId = this.db.get("ships").get(0).value().id;
    return this.updateShip(shipId, settings);
  }

  sendBatchToFirstShip() {
    const ship = this.db.get("ships").get(0).value();
    console.log(`${ship.url}/batch?ship=${ship.id}&organization=${this.getOrgAddr()}&secret=1234`);
    return this.post(`${ship.url}/batch?ship=${ship.id}&organization=${this.getOrgAddr()}&secret=1234`)
      .send({
        url: `http://${this.getOrgAddr()}/_batch-all`,
        format: "json"
      });
  }

  updateShip(shipId, settings) {
    const ship = this.db.get("ships").find({ id: shipId }).value();
    ship.private_settings = _.merge(ship.private_settings || {}, settings);
    return this.sendNotification("ship:update", ship);
  }

  sendNotification(topic, message) {
    const body = {
      Type: "Notification",
      Timestamp: new Date(),
      Subject: topic,
      Message: JSON.stringify(message)
    };
    return Promise.all(this.db.get("ships").reduce((acc, ship) => {
      _.map(ship.manifest.subscriptions, subscription => {
        acc.push(
          this.post(`${ship.url}${subscription.url}?ship=${ship.id}&organization=${this.getOrgAddr()}&secret=1234`)
          .set("x-amz-sns-message-type", "dummy")
          .send(body)
        );
      });
      return acc;
    }, []));
  }

  diff(objectA, objectB) {
    const diff = {};
    _.reduce(objectB, (acc, value, key) => {
      if (objectA[key] != value) {
        acc[key] = [objectA[key] || null, value];
      }
      return acc;
    }, diff);

    return diff;
  }

  getMatchingSegments(user) {
    if (!user._segment_ids) {
      user = this.findUser(user);
    }
    const matchingSegments = this.db.get("segments")
      .intersectionBy(user._segment_ids);
    return matchingSegments;
  }

  install(shipUrl) {
    return this.get(`${shipUrl}/manifest.json`)
      .then(res => {
        return this.db.get("ships").insert({
          url: shipUrl,
          manifest: res.body,
          private_settings: {}
        }).write();
      });
  }

  dashboard(shipId) {
    const ship = this.db.get("ships").find({ id: shipId }).value();

    return `${ship.url}${ship.manifest.admin}?ship=${ship.id}&organization=${this.getOrgAddr()}&secret=1234`;
  }

  batch(userIds) {
    return this.db.get("users").intersectionBy(_.map(userIds, i => {
      return { id: i };
    }), "id").value().map(u => JSON.stringify(u)).join("\n");
  }

  batchAll() {
    const users = this.db.get("users").cloneDeep();
    return users.value().map(u => {
      u.segments_id = this.getMatchingSegments(u).map(s => s.id);
      return JSON.stringify(u);
    }).join("\n");
  }
}

module.exports = Minihull;
