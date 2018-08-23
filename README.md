# Mini Hull

## Compatibility

minihull v3.0.0 relies on Hull-client v2 and Hull-node 0.14.0.
Use minihull 2.1.2 if you're using previous versions of the libraries

## scriptable usage

For automatic tests use the following methods:

- **stubConnector()** - for stubbing response for connector
- **stubUserSegments()** - for stubbing response for user segments
- **stubAccountSegments()** - for stubbing response for account segments
- **stubBatch()** - for stubbing batching to connector

```js
const MiniHull = require("minihull");
const miniHull = new Minihull();
const connectorId = minihull.fakeId();

miniHull.listen(3000);

miniHull.stubConnector({
  id: connectorId,
  private_settings: {
    enrich_segments: ["1"]
  }
});

miniHull.stubUserSegments([{
  id: "1",
  name: "A"
}]);

miniHull.stubAccountSegments([{
  id: "1",
  name: "A"
}]);

miniHull.postConnector(connectorId, "http://localhost:8000/test").then(() => {
  assert(miniHull.requests.get("incoming").length, 1);
  miniHull.close();
});
```

## interactive usage

```js
$ bin/mini-hull
miniHull listening on 3000
miniHull > fakeUsers(5)
miniHull > fakeSegments(2)
miniHull > fakeAssignment()
miniHull > mimicInstall("http://connector-host:8000")
miniHull > mimicPostConnector("/custom-operation")
miniHull > requests.get("incoming").value()
```
