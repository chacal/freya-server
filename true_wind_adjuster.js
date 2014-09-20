var readline = require('readline');
var Bacon = require("baconjs").Bacon;
var calibration = require("./calibration.js");

var AWA;
var AWS;
var BTS;

calibration.initialize("tws_correction_table.csv");

var rl = readline.createInterface({ input: process.stdin, output: "/dev/null" });
var nmeaMessages = Bacon.fromEventTarget(rl, "line").filter(function(line) { return line.match(/^\$.*\*/) });

var apparentWindMessages = nmeaMessages.filter(function(line) { return line.match(/.*MWV.*R/) });

apparentWindMessages.onValue(function(awsLine) {
  var matches = /MWV,(.*),R,(.*?),/.exec(awsLine);
  AWA = matches[1];
  AWS = matches[2];
});

var boatSpeedMessages = nmeaMessages.filter(function(line) { return line.match(/.*VHW.*/) });

boatSpeedMessages.onValue(function(line) {
  var matches = /VHW.*M,(.*?),/.exec(line);
  BTS = matches[1];
});

Bacon.interval(200).onValue(function() {
  twsCorrection = calibration.calculateTwsCorrection(AWA, AWS, BTS);
  console.log("AWA: " + AWA + ", AWS: " + AWS + ", BTS: " + BTS + ", Correction: " + twsCorrection)
});