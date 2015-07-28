var fs = require('fs')
var path = require('path')
var io = require('indian-ocean')
var d3 = require('d3')
var module_root = path.join(__dirname, '../')

var files_dir = path.join(module_root, 'files')

var files = fs.readdirSync(files_dir)

console.log(files)

bakeFiles(files)

function extractExt (fileName) {
  return io.discernFormat(fileName)
}

function bakeFiles (appsList) {
  var file_group = d3.select('#main').selectAll('.file-group').data(appsList).enter()
    .append('a')
    .classed('file-group', true)
    .attr('href', function(d){
      return path.join(files_dir, d)
    })
    .attr('download', function(d){
      return d
    })

  file_group.append('div')
    .classed('file-icon', true)
    .attr('data-icon', function(d){
      return extractExt(d)
    })

  file_group.append('div')
    .classed('file-name', true)
    .html(function(d){
      return d
    })
}