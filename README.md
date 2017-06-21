# minihull


## scriptable usage

```js
const Minihull = require("minihull");
const minihull = new Minihull();

minihull.listen(3000);

minihull.minicInstall("http://connector-host:8000")
.then(() => minihull.mimicCallConnector("/custom-operation"))
.then(() => {
  assert(minihull.requests.get("incoming").length, 1);
  minihull.close();
});
```

## extendable usage

```js
const Minibase = require("minihull/src/minibase");

class Miniapp extends Minibase {
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

module.exports = Miniapp;
```

## interactive usage

```js
$ bin/minihull
minihull listening on 3000
minihull > users()
minihull > fakeUsers(2)
minihull > users()
minihull > mimicInstall("http://connector-host:8000")
minihull > mimicCallConnector("/custom-operation")
minihull > requests.get("incoming").value()
```
