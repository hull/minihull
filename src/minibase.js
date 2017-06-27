const express = require("express");
const low = require("lowdb");
const EventEmitter = require("events");
const bodyParser = require("body-parser");
const http = require("http");
const fs = require("fs");
const request = require("superagent");
const superagentPromisePlugin = require("superagent-promise-plugin");
const _ = require("lodash");
const Promise = require("bluebird");
const util = require("util");
const sinon = require("sinon");

const faker = require("faker");
const shell = require("shelljs");
const moment = require("moment");

/**
 * Base class allowing to run simple mocking server with express and lowdb.
 * Can be extended to provide custom functionality.
 */
class Minibase {
  constructor() {
    this.app = express();
    this.db = low();
    this.requests = low().defaults({ incoming: [], outgoing: [] });
    this.shell = shell;
    this.moment = moment;
    this.faker = faker;
    this._ = _;
    this.port;
    this.server = http.createServer(this.app);

    this.app.use(bodyParser.json());
    this.app.use((req, res, next) => {
      this.requests.get("incoming").push(_.pick(req, "headers", "url", "method", "body", "query", "params")).write();
      const count = this.requests.get("incoming").value().length;
      this.emit("incoming.request", req, count);
      this.emit("incoming.request."+count, req, count);
      this.emit("incoming.request#"+count, req, count);
      this.emit("incoming.request@"+req.url, req, count);
      next();
    });

    sinon.addBehavior("returnsJson", (fake, json) => {
      fake.callsFake((req, res) => {
        res.json(json)
      });
    });

    sinon.addBehavior("returnsStatus", (fake, status) => {
      fake.callsFake((req, res) => {
        res.status(status).end();
      });
    });

    ["get", "post", "put", "delete"].map(method => {
      this[`stub${_.upperFirst(method)}`] = (url, callback) => {
        return this.appStub.withArgs(sinon.match.any, sinon.match.any, sinon.match.any, _.upperCase(method), sinon.match(url));
      };
    });
    this.stubAll = (url, callback) => {
      return this.appStub.withArgs(sinon.match.any, sinon.match.any, sinon.match.any, sinon.match.any, sinon.match(url));
    };

    this.appStub = function appStub(req, res, next, method, url) {
      next();
    };
    sinon.stub(this, "appStub");
    this.appStub.callThrough();
    this.app.use((req, res, next) => {
      this.appStub(req, res, next, req.method, req.url);
    });

    ["get", "post", "put", "delete"].map(verb => {
      this[verb] = (url) => {
        return request[verb](url)
          .use(superagentPromisePlugin)
          .on("request", (reqData) => {
            this.requests.get("outgoing").push(reqData).write();
            this.emit("outgoing.request", reqData);
            this.emit("outgoing.request."+(this.requests.get("outgoing").value().length), reqData);
            this.emit("outgoing.request#"+(this.requests.get("outgoing").value().length), reqData);
          });
      };
    });
    return this;
  }

  /**
   * Start the internal Express application
   * @param  {Number} port
   * @return {Promise}
   */
  listen(port) {
    this.port = port;
    return Promise.fromCallback((callback) => {
      this.server.listen(port, callback);
    });
  }

  /**
   * Close the server - important for automatic testing when you start and stop the server multiple times.
   */
  close() {
    return this.server.close();
  }

  /**
   * For interactive usage - allows to set current internal db state to a file on disk.
   * @param  {String} name name of the json file - will be appended with `json` extension
   */
  save(name) {
    fs.writeFileSync(`${name}.json`, JSON.stringify(this.db.getState()));
  }

  /**
   * For interactive usage - allows to load previously saved db state back to application.
   * @param  {String} name name of the json file - will be appended with `json` extension
   * @return {Object}
   */
  load(name) {
    const newState = JSON.parse(fs.readFileSync(`${name}.json`));
    this.db.setState(newState);
    return this.db.getState();
  }

  /**
   * For interactive usage - ists all json files in current directory
   * @return {Arrayy}
   */
  list() {
    return this.shell.ls('*.json').map(f => f.replace(".json", ""));
  }
}

util.inherits(Minibase, EventEmitter);
module.exports = Minibase;
