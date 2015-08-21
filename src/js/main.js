var fs = require('fs')
var path = require('path')
var io = require('indian-ocean')
var d3 = require('d3')
var SMB2 = require('smb2');
var module_root = path.join(__dirname, '../')

var mime = require('mime');

var secrets = io.readDataSync(module_root + 'secrets.json')

// create an SMB2 instance
var smb2Client = new SMB2({
  share: secrets.share,
  domain: secrets.domain,
  username: secrets.username,
  password: secrets.password,
  debug: false
});

var createObjectURL = window.URL.createObjectURL; 

var file_locations = [
  {
    name: 'Admin files',
    getFiles: function(cb){
      var files_dir = path.join(module_root, 'files')
      var files = fs.readdirSync(files_dir).map(function(fileName){
        return {
          name: fileName,
          dir: files_dir
        }
      })
      cb(files)
    }
  },{
    name: 'Network Share - 1',
    getFiles: function(cb){
      var files_dir = 'digital-interactives\\mhk'
      smb2Client.readdir(files_dir, function(err, files){
        if(err) throw err
        var files_data = files.map(function(fileName){
          return {
            name: fileName,
            dir: files_dir.replace('\\','\\\\'), // Escape the `\`
            fetch: true
          }
        })
        cb(files_data)
      });
    }
  }
]

file_locations.forEach(function(locationInfo){
  var loc_name = locationInfo.name
  locationInfo.getFiles(function(result){
    bakeFiles(loc_name, result)
  })
})

function bakeFiles (locName, files) {
  var location_group = d3.select('#main').append('div')
      .classed('location-group', true)

  location_group.append('div')
    .classed('title', true)
    .html(locName)

  var file_group = location_group.selectAll('.file-group').data(files).enter()
    .append('a')
    .classed('file-group', true)
    .attr('draggable', true) // This just makes it look nicer
    .each(function(d){
      var d3_this = d3.select(this)
      // If we don't need to fetch, just make it an href
      if (!d.fetch) {
        d3_this
          .attr('href', path.join(d.dir, d.name))
      } else  {
        d3_this
          .attr('data-share', true)
          .attr('data-share-loc', path.join(d.dir, d.name))
          .attr('href', '#')
      }
    })
    .attr('download', function(d){
      return d.name
    })


  file_group.append('div')
    .classed('file-icon', true)
    .attr('aria-label', function(d){
      return io.discernFormat(d.name)
    })

  file_group.append('div')
    .classed('file-name', true)
    .html(function(d){
      return d.name
    })

  d3.selectAll('.file-group[data-share="true"]').on('click', function(d){
    var self = this
    var d3_this = d3.select(this)
    if (d3_this.attr('href') == '#') {
      d3.event.preventDefault()
      var file_path = [d.dir, d.name].join('\\\\')
      smb2Client.readFile(file_path, function(err, data){
        if (err) throw err
        var type = mime.lookup(d.name)
        var blob = new Blob([ data ], { type: type })
        var href = createObjectURL(blob)
        d3_this.attr('href', href)
        self.click()
      });
    }
  })
}