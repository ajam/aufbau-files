var fs = require('fs')
var path = require('path')
var io = require('indian-ocean')
var d3 = require('d3')
var SMB2 = require('smb2')
var _ = require('underscore')
var $ = require('jquery')
var queue = require('queue-async')

var files_module_root = path.join(__dirname, '../')
// TODO, change this to `Application Support`
var buckets_info_path = path.join(__dirname, 'js', 'buckets.json')

var buckets = io.readDataSync(buckets_info_path)
var tmp_dir = path.join(files_module_root, 'tmp')

// For writing out files from smb
var streamifier = require('streamifier')
var mime = require('mime');

// smb connection details
var secrets = io.readDataSync(path.join(files_module_root, 'secrets.json'))

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

var location_types = {
  local: {
    getFiles: function(dir, cb){
      var files_dir = path.join(files_module_root, dir)
      var files = fs.readdirSync(files_dir).map(function(fileName){
        return {
          name: fileName,
          dir: files_dir
        }
      })
      cb(files)
    }
  },
  smb: {
    getFiles: function(dir, cb){
      var files_dir = dir
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
}

// Put these in a queue so we add them in the same order every time
var q = queue(1)

// Bake files in each location according to its `getFiles` fn
buckets.forEach(function(bucketInfo){
  q.defer(bakeBucket, bucketInfo)
})

q.awaitAll(function(err, results){
  results.forEach(function(resultInfo){
    bakeFiles(resultInfo.locName, resultInfo.result)
  })
})

var d3_add_bucket_form = d3.select('form#add-bucket')

d3_add_bucket_form.on('submit', addBucket)

function bakeBucket(bucketInfo, cb){
  var loc_name = bucketInfo.name
  location_types[bucketInfo.type].getFiles(bucketInfo.dir, function(result){
    // bakeFiles(loc_name, result)
    cb(null, {locName: loc_name, result: result})
  })
}

function getNewBucketInfo(){
  var bucket = {}
  d3.event.preventDefault()
  var arr = $(d3_add_bucket_form.node()).serializeArray()
  arr.forEach(function(field){
    bucket[field.name] = field.value
  })

  return bucket

}

function addBucket(){
  var bucket_info = getNewBucketInfo()
  bakeBucket(bucket_info)
  buckets.push(bucket_info)
  saveBucketList()
  clearBucketForm()
}

function clearBucketForm(){
  d3_add_bucket_form.selectAll('.bucket-input').each(function(){
    $(this).val('')
  })
}

function saveBucketList(){
  io.writeData(buckets_info_path, buckets, function(err){
    if (err) {
      console.log(err)
    }
  })
}

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