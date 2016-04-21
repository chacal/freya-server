var Bacon = require("baconjs").Bacon
var Promise = require('bluebird')
var csv = require("fast-csv")
var Table = require('cli-table')
var path = require('path')
var _ = require('lodash')

var TargetCalculator = function(twsStream, twaStream) {
  this.twsStream = twsStream
  this.twaStream = twaStream
  this.targets = this.createTargetsStream()
}

TargetCalculator.prototype.createTargetsStream = function() {
  var _this = this
  return Bacon.fromPromise(readPolarTableAsync(path.resolve(__dirname, 'freya_main_jib_polars.csv')))
    .flatMapLatest(function(polars) {
      return _this.twsStream.combine(_this.twaStream, function(tws, twa) { return calculateTargets(tws, twa, polars) })
    })
}


function readPolarTableAsync(file) {
  return new Promise(function (resolve) {
    var tableFromCsv = []

    csv
      .fromPath(file, {comment: "#"})
      .on("data", _.partial(insertToTable, tableFromCsv))
      .on("end", function () {
        printPolarTable(tableFromCsv)
        resolve(tableFromCsv)
      })

    function insertToTable(table, data) {
      table.push(_.map(data, parseFloat))
    }
  })

  function printPolarTable(table) {
    var outputTable = new Table()
    for (var i = 0; i < table.length; i++) {
      outputTable.push(table[i])
    }
    console.log("\n\nPolar table:")
    console.log(outputTable.toString(), '\n\n')
  }
}

function calculateTargets(tws, twa, polars) {
  var usedTwa = roundToPoint1(twa > 180 ? 360 - twa : twa)

  // Find table rows & columns for surrounding corners
  var tableTws1Index = _.findLastIndex(polars[0], function(tableTws) { return tableTws < tws })
  var tableTws2Index = _.findIndex(polars[0], function(tableTws) { return tableTws >= tws })
  var tableTwa1Index = _.findLastIndex(_.map(polars, _.first), function(tableTwa) { return tableTwa < usedTwa })
  var tableTwa2Index = _.findIndex(_.map(polars, _.first), function(tableTwa) { return tableTwa >= usedTwa })


  // Surrounding corner table values
  var x1y1 = polars[tableTwa1Index][tableTws1Index]
  var x1y2 = polars[tableTwa2Index][tableTws1Index]
  var x2y1 = polars[tableTwa1Index][tableTws2Index]
  var x2y2 = polars[tableTwa2Index][tableTws2Index]

  // 2D interpolate between surrounding corner values
  var targetSpeed = roundToPoint1(interpolate(x1y1, x2y1, x1y2, x2y2, tws, polars[0][tableTws1Index], polars[0][tableTws2Index], usedTwa, _.map(polars, _.first)[tableTwa1Index], _.map(polars, _.first)[tableTwa2Index]))

  return { tws: tws, twa: usedTwa, targetSpeed: targetSpeed }

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

  function roundToPoint1(value) { return Math.round(value * 10) / 10 }
}


module.exports = TargetCalculator