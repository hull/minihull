const assert = require("assert");

const Minihull = require("./src/minihull");
const minihull = new Minihull({
  users: [{
    name: "foo",
    id: "123"
  }]
});

minihull.listen(3000).then(() => {
  assert.equal(minihull.users().first().get("foo").value(), undefined);
  minihull.updateUser({ id: "123" }, { foo: "bar" });
  assert.equal(minihull.users().first().get("foo").value(), "bar");
  minihull.close();
});


