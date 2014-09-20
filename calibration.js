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
  // Find table rows & columns for surrounding corners
  tableAwa1 = roundDownTo10(awa)
  tableAwa2 = roundUpTo10(awa)
  tableBts1 = Math.floor(bts)
  tableBts2 = Math.ceil(bts)

  // Surrounding corner table values
  x1y1 = twsCorrectionTable[tableAwa1 / 10][tableBts1];  // divide AWA by 10 to get the correct row index
  x1y2 = twsCorrectionTable[tableAwa2 / 10][tableBts1];
  x2y1 = twsCorrectionTable[tableAwa1 / 10][tableBts2];
  x2y2 = twsCorrectionTable[tableAwa2 / 10][tableBts2];

  // 2D interpolate between surrounding corner values
  return roundToPoint1(interpolate(x1y1, x2y1, x1y2, x2y2, bts, tableBts1, tableBts2, awa, tableAwa1, tableAwa2))
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


function interpolate(x1y1, x2y1, x1y2, x2y2, x, x1, x2, y, y1, y2) {
  if(x1 == x2 && y1 == y2) {
    return x1y1  // Both row & column match to the table
  } else if(x1 == x2) {
    return linearInterpolate(y, y1, y2, x1y1, x1y2)  // Column matches table, interpolate row
  } else if(y1 == y2) {
    return linearInterpolate(x, x1, x2, x1y1, x2y1)  // Row matches table, interpolate column
  } else {
    return bilinearInterpolate(x1y1, x2y1, x1y2, x2y2, x, x1, x2, y, y1, y2)  // Interpolate both row & column
  }
}

function bilinearInterpolate(x1y1, x2y1, x1y2, x2y2, x, x1, x2, y, y1, y2) {
  console.assert(x1 != x2, "Can't do bilinear interpolation with equal x values!")
  console.assert(y1 != y2, "Can't do bilinear interpolation with equal y values!")
  r1 = ((x2 - x) / (x2 - x1) * x1y1) + ((x - x1) / (x2 - x1) * x2y1)
  r2 = ((x2 - x) / (x2 - x1) * x1y2) + ((x - x1) / (x2 - x1) * x2y2)
  p = ((y2 - y) / (y2 - y1) * r1) + ((y - y1) / (y2 - y1) * r2)
  return p
}

function linearInterpolate(x, x1, x2, y1, y2) {
  return y1 + (y2 - y1) * ((x - x1) / (x2 - x1))
}



///// Helpers /////

function map2DTable(table, func) {
  for (var row = 0; row < table.length; row++) {
    for (var col = 0; col < table[row].length; col++) {
      func(row, col)
    }
  }
}

function roundDownTo10(value) { return Math.floor(value / 10) * 10; }
function roundUpTo10(value) { return Math.ceil(value / 10) * 10; }

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