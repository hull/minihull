minihull.segments().push({
  id: "A",
  name: "Foo"
});

minihull.fakeUsers(2);
minihull.users().get(0).set("segment_id", ["A"]);
