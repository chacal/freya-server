var csv = require("fast-csv");

var twsTable = [];

exports.initialize = function() {

  csv
      .fromPath("tws_correction_table.csv", {comment: "#"} )
      .on("data", function(data) {
        twsTable.push(data)
      });
};

exports.calculateTwsCorrection = function(awa, aws, bts) {
  tableAwa = roundTo10(awa);
  tableBts = Math.round(bts);
  rowIndex = tableAwa / 10;
  columnIndex = tableBts;
  return twsTable[rowIndex][columnIndex];
};

function roundTo10(value) { return Math.round(value / 10) * 10; }