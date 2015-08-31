var fs = require('fs')
var path = require('path')
var io = require('indian-ocean')
var d3 = require('d3')
var SMB2 = require('smb2')
var _ = require('underscore')

var module_root = path.join(__dirname, '../')
var tmp_dir = path.join(module_root, 'tmp')

// For writing out files from smb
var streamifier = require('streamifier')
var mime = require('mime');

// smb connection details
var secrets = io.readDataSync(path.join(module_root, 'secrets.json'))

function connectToShare(){
  // create an SMB2 instance
  var smb2Client = new SMB2({
    share: secrets.share,
    domain: secrets.domain,
    username: secrets.username,
    password: secrets.password,
    debug: false
  });

  return smb2Client
}

// Remove the `tmp/` directory where we download files to
function clearTmpDir(){
  var tmp_files = io.readdirExclude(tmp_dir, '.gitignore', function(err, files){

    files.forEach(function(file){
      if (file != '.gitignore') {
        io.fs.unlink(path.join(tmp_dir, file), function(err, b){
          if (err) {
            throw err
          }
        })
      }
    })
  })
}

// Only clear once, on connection
var clearTmpDir_once = _.once(clearTmpDir)

// What buckets we want to display
var file_locations = [
  {
    name: 'Admin files',
    getFiles: function(cb){
      // Also on init, clear the tmp directory
      clearTmpDir_once()

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
      var smb2Client = connectToShare()
      smb2Client.readdir(files_dir, function(err, files){
        if(err) throw err
        var files_data = files.map(function(fileName){
          return {
            name: fileName,
            dir: files_dir.replace('\\','\\\\'), // Escape the `\`
            fetch: true
          }
        })

        smb2Client.close()
        cb(files_data)
      });
    }
  }
]

// Bake files in each location according to its `getFiles` fn
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
    var d3_btn = d3.select(this)
    if (d3_btn.attr('href') == '#') {
      d3.event.preventDefault()
      d3_btn.attr('data-share', 'downloading')

      var file_path = [d.dir, d.name].join('\\\\')
      var type = mime.lookup(d.name)

      var smb2Client = connectToShare()
      smb2Client.readFile(file_path, function(err, data){
        if (err) {
          throw err
        }

        var file_path = path.join(tmp_dir, d.name)
        var file = io.fs.createWriteStream(file_path);

        // Turn our buffer into a strea
        // And write it to our tmp directory
        streamifier
          .createReadStream(data)
          .pipe(file)
          .on('finish', function(){
            // Set the href location to that tmp file
            // And click to download
            d3_btn.attr('href', file_path)
            self.click()
            smb2Client.close()
            d3_btn.attr('data-share', 'true')
          })
      });
    }
  })
}