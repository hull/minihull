const express = require("express");
const low = require("lowdb");
const EventEmitter = require("events");
const bodyParser = require("body-parser");
const https = require("https");
const http = require("http");
const keypair = require("self-signed");
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

class Minibase {
  constructor({ enableHttps = false }) {
    this.app = express();
    this.db = low();
    this.requests = low().defaults({ incoming: [], outgoing: [] });
    this.shell = shell;
    this.moment = moment;
    this.faker = faker;
    this._ = _;
    this.port;

    if (enableHttps) {
      const options = keypair({
        name: 'localhost',
        city: 'Blacksburg',
        state: 'Virginia',
        organization: 'Test',
        unit: 'Test'
      }, {
        alt: ['127.0.0.1']
      });
      this.server = https.createServer({
        key: options.private,
        cert: options.cert
      }, this.app);
    } else {
      this.server = http.createServer(this.app);
    }

    this.app.use(bodyParser.json());
    this.app.use((req, res, next) => {
      this.requests.get("incoming").push(_.pick(req, "headers", "url", "method", "body", "query", "params")).write();
      this.emit("incoming.request", req);
      this.emit("incoming.request."+(this.requests.get("incoming").value().length), req);
      this.emit("incoming.request#"+(this.requests.get("incoming").value().length), req);
      this.emit("incoming.request@"+req.url, req);
      next();
    });

    ["get", "post", "put", "delete"].map(method => {
      this[`stub${_.upperFirst(method)}`] = (url, callback) => {
        return this.appStub.withArgs(sinon.match.any, sinon.match.any, sinon.match.any, _.upperCase(method), sinon.match(url));
      };
    });
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

  listen(port) {
    this.port = port;
    return Promise.fromCallback((callback) => {
      this.server.listen(port, callback);
    });
  }

  close() {
    return this.server.close();
  }

  save(name) {
    fs.writeFileSync(`${name}.json`, JSON.stringify(this.db.getState()));
  }

  resetDbState() {
    this.db.setState({});
  }

  load(name) {
    const newState = JSON.parse(fs.readFileSync(`${name}.json`));
    this.db.setState(newState);
    return this.db.getState();
  }

  list() {
    return this.shell.ls('*.json').map(f => f.replace(".json", ""));
  }
}

util.inherits(Minibase, EventEmitter);
module.exports = Minibase;
