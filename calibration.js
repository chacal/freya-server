var Promise = require('bluebird');
var csv = require("fast-csv");
var _ = require("underscore");
var Table = require('cli-table');

var twsCorrectionTable = [];
var twdCorrectionTable = [];
var NA_TABLE_VALUE = "-"



///// Public API /////

exports.initialize = function(twsCorrectionTableFile, twdCorrectionTableFile) {
  return readCorrectionTable(twsCorrectionTableFile, "TWS Correction Table")
    .then(function(twsTable) {
      twsCorrectionTable = twsTable
      return readCorrectionTable(twdCorrectionTableFile, "TWD Correction Table")
    })
    .then(function(twdTable) {
      twdCorrectionTable = twdTable
    })
}

exports.calculateTwsCorrection = function(awa, aws, bts) {
  return readCalibrationFromTable(twsCorrectionTable, awa, aws, bts)
}

exports.calculateTwdCorrection = function(awa, aws, bts) {
  return readCalibrationFromTable(twdCorrectionTable, awa, aws, bts)
}



///// Private API /////

function readCalibrationFromTable(table, awa, aws, bts) {
  // Find table rows & columns for surrounding corners
  tableAwa1 = roundDownTo10(awa)
  tableAwa2 = roundUpTo10(awa)
  tableBts1 = Math.floor(bts)
  tableBts2 = Math.ceil(bts)

  // Surrounding corner table values
  x1y1 = table[tableAwa1 / 10][tableBts1]  // divide AWA by 10 to get the correct row index
  x1y2 = table[tableAwa2 / 10][tableBts1]
  x2y1 = table[tableAwa1 / 10][tableBts2]
  x2y2 = table[tableAwa2 / 10][tableBts2]

  // 2D interpolate between surrounding corner values
  return roundToPoint1(interpolate(x1y1, x2y1, x1y2, x2y2, bts, tableBts1, tableBts2, awa, tableAwa1, tableAwa2))
}


function readCorrectionTable(file, tableTitle) {
  return new Promise(function (resolve) {
    var tableFromCsv = []
    var interpolatedTable = []

    csv
      .fromPath(file, {comment: "#"})
      .on("data", _.partial(insertToTable, tableFromCsv))
      .on("end", function () {
        interpolatedTable = interpolateTable(tableFromCsv)
        console.log("\n\n" + tableTitle + ":")
        printCorrectionTable(interpolatedTable)
        resolve(interpolatedTable)
      })

    function insertToTable(table, data) {
      table.push(_.map(data, tryParseInt))
    }
  })
}


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


function printCorrectionTable(correctionTable) {
  var outputTable = new Table({
    head: ["", "0 kts", "1 kts", "2 kts", "3 kts", "4 kts", "5 kts", "6 kts", "7 kts", "8 kts"],
    colWidths: [5, 7, 7, 7, 7, 7, 7, 7, 7, 7],
    colAligns: ["right", "right", "right", "right", "right", "right", "right", "right", "right", "right"],
    style: {compact: true}
  })
  for (var i = 0; i < correctionTable.length; i++) {
    var rowHeader = (10 * i).toString()
    var outputTableRow = {}
    outputTableRow[rowHeader] = correctionTable[i]
    outputTable.push(outputTableRow)
  }
  console.log(outputTable.toString())
}



///// Helpers /////

function map2DTable(table, func) {
  for (var row = 0; row < table.length; row++) {
    for (var col = 0; col < table[row].length; col++) {
      func(row, col)
    }
  }
}

function roundDownTo10(value) { return Math.floor(value / 10) * 10 }
function roundUpTo10(value) { return Math.ceil(value / 10) * 10 }

function roundToPoint1(value) { return Math.round(value * 10) / 10 }

function tryParseInt(value) {
  var parsed = parseInt(value)
  return _.isNaN(parsed) ? value : parsed
}

function copy2DArray(toBeCopied) {
  return toBeCopied.map(function(arr) {
    return arr.slice()
  })
}