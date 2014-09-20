var csv = require("fast-csv");
var _ = require("underscore");

var twsCorrectionTable = [];
var NA_TABLE_VALUE = "-"



///// Public API /////

exports.initialize = function(twsCorrectionTableFile) {
  var tableFromCsv = [];

  csv
    .fromPath(twsCorrectionTableFile, {comment: "#"} )
    .on("data", _.partial(insertToTable, tableFromCsv))
    .on("end", function () {
      twsCorrectionTable = interpolateTable(tableFromCsv)
    });

  function insertToTable(table, data) {
    table.push(_.map(data, tryParseInt))
  }
};

exports.calculateTwsCorrection = function(awa, aws, bts) {
  tableAwa = roundTo10(awa);
  tableBts = Math.round(bts);
  rowIndex = tableAwa / 10;
  columnIndex = tableBts;
  return twsCorrectionTable[rowIndex][columnIndex];
};



///// Private API /////

function interpolateTable(table) {
  interpolatedTable = copy2DArray(table)

  map2DTable(table, function(row, col) {
    if(table[row][col] == NA_TABLE_VALUE) {
      var interpolatedValue = calculateAvgSum(table, row, col)
      interpolatedTable[row][col] = _.isNaN(interpolatedValue) ? 0 : interpolatedValue
    }
  })

  return interpolatedTable
}

function calculateAvgSum(table, x, y) {
  var upperPart = 0
  var lowerPart = 0
  var AFFECTING_DISTANCE = 8

  map2DTable(table, function(row, col) {
    if(table[row][col] != NA_TABLE_VALUE) {
      var d = distance(x, y, row, col)
      var weight = 1 / (d*d)
      if(d <= AFFECTING_DISTANCE) {
        upperPart += weight * table[row][col]
        lowerPart += weight
      }
    }
  })

  return roundToPoint1(upperPart / lowerPart)

  function distance(x1, y1, x2, y2) {
    var dx = Math.abs(x2 - x1)
    var dy = Math.abs(y2 - y1)
    return Math.sqrt(dx * dx + dy * dy)
  }
}



///// Helpers /////

function map2DTable(table, func) {
  for (var row = 0; row < table.length; row++) {
    for (var col = 0; col < table[row].length; col++) {
      func(row, col)
    }
  }
}

function roundTo10(value) { return Math.round(value / 10) * 10; }

function roundToPoint1(value) { return Math.round(value * 10) / 10; }

function tryParseInt(value) {
  var parsed = parseInt(value)
  return _.isNaN(parsed) ? value : parsed;
}

function copy2DArray(toBeCopied) {
  return toBeCopied.map(function(arr) {
    return arr.slice();
  });
}