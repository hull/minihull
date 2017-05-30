# minihull


### scriptable usage

```
const Minihull = require("minihull");
const minihull = new Minihull();

minihull.listen(3000);

minihull.install("http://connector-host:8000")
.then(() => minihull.callFirstShip("/custom-operation"))
.then(() => {
  assert(minihull.requests.get("incoming").length, 1);
  minihull.close();
});
```

### extendable usage

```
import Minibase from "minihull/src/minibase";

export default class Miniapp extends Minibase {
  constructor(options = {}) {
    super(options);

    this.db.defaults({ contacts: [] }).write();

    this.app.get("/contacts", (req, res) => {
      res.json({
        contacts: this.db.get("contacts").value()
      });
    });
  }

  customMethod() {}
}
```

### interactive usage

```
$ bin/minihull
minihull listening on 3000
minihull > users()
minihull > fakeUsers(2)
minihull > users()
minihull > install("http://connector-host:8000")
minihull > callFirstShip("/custom-operation")
minihull > requests.get("incoming").value()
```
