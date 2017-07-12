# Mini Hull

## scriptable usage

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
miniHull.stubSegments([{
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
