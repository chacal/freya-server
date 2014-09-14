var fs = require('fs');
var Bacon = require("baconjs").Bacon;

var lines = fs.readFileSync("testdata/Freya_20140913_1638.log").toString().split('\n');

Bacon.sequentially(2, lines).onValue(function(line) {
  console.log(line);
});
