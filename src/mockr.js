//@flow

const MiniHull = require("./mini-hull");
const nock = require("nock");
const request = require("supertest");
const jwt = require("jwt-simple");
import type { $Application } from "express";
import type {
  HullConnector,
  HullConnectorConfig,
  UserSegments,
  AccountSegments,
  HullClient
} from "hull";

const noop = (any): void => {};

const MINIHULL_PORT = 8001;
const MINIHULL_URL = "localhost";
const FIREHOSE = "/api/v1/firehose";

export type MockrOptions = {
  beforeEach: Function => {},
  afterEach: Function => {},
  server: any => $Application,
  callbackTimeout: number,
  Hull: HullClient,
  connectorConfig: HullConnectorConfig,
  connector: HullConnector,
  user_segments: Array<UserSegments>,
  account_segments: Array<AccountSegments>
};

type LogEvent = {
  level: "error" | "warning" | "debug" | "info",
  message: string,
  data: {}
};

type FirehoseEvent = {
  [string]: any,
  type: "track" | "traits",
  body: {
    active?: boolean,
    event?: string
  },
  claims: {}
};

type HullResponse = {
  logs: Array<LogEvent>,
  firehose: Array<FirehoseEvent>,
};

type MockrResponse = {
  response: {
    logs: Array<LogEvent>,
    firehose: Array<FirehoseEvent>,
    minihull?: MiniHull,
    request?: () => any,
    server?: $Application
  }
};

const pushToFirehose = firehose => req =>
  firehose.push(
    ...req.body.batch.map(r => ({
      ...r,
      claims: jwt.decode(r.headers["Hull-Access-Token"], "", true)
    }))
  );

module.exports = function mockr({
  server,
  Hull,
  connectorConfig = {
    port: 8080,
    clientConfig: {}
  },
  callbackTimeout = 1800,
  beforeEach,
  afterEach,
  connector = {},
  user_segments = [],
  account_segments = []
}: MockrOptions): MockrResponse {
  const { port } = connectorConfig;
  const { manifest } = connector;
  const mocks = {};

  const response = { logs: [], firehose: [] };

  mocks.response = response;

  const logger = (level, message, data) =>
    response.logs.push({ level, message, data });

  Hull.Client.logger.on("logged", logger);

  beforeEach(done => {
    const logs = [];
    const firehose = [];

    response.firehose = firehose;
    response.logs = logs;

    const minihull = new MiniHull();
    mocks.minihull = minihull;
    minihull.listen(8001);
    minihull.stubConnector(connector);
    minihull.stubUsersSegments(user_segments);
    minihull.stubAccountsSegments(account_segments);
    minihull.userUpdate = ({ connector, messages }, callback = noop) => {
      const timeout = setTimeout(() => callback(response), callbackTimeout);
      const send = payload => {
        clearTimeout(timeout);
        callback(payload);
      };
      minihull.on(`incoming.request@${FIREHOSE}`, pushToFirehose(firehose));
      minihull
        .smartNotifyConnector(
          `http://localhost:${port}${manifest.subscriptions[0].url}`,
          "user:update",
          connector,
          messages
        )
        .then(() => send({ firehose, logs }));
    };
    mocks.server = server({
      Hull,
      connectorConfig: {
        skipSignatureValidation: true,
        hostSecret: "1234",
        port,
        ...connectorConfig,
        clientConfig: {
          flushAt: 1,
          protocol: "http",
          firehoseUrl: `http://${MINIHULL_URL}:${MINIHULL_PORT}${FIREHOSE}`,
          ...connectorConfig.clientConfig
        }
      }
    });
    mocks.request = request(server);
  });

  afterEach(() => {
    mocks.minihull.close();
    // mocks.server.close();
    // mocks.nock.cleanAll();
  });

  return mocks;
};
