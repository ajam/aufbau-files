var fs = require('fs')
var path = require('path')
var io = require('indian-ocean')
var d3 = require('d3')
var SMB2 = require('smb2')
var _ = require('underscore')
var $ = require('jquery')
var queue = require('queue-async')

var ipc = require('ipc')

var user_data_dir = ipc.sendSync('synchronous-message', 'userData')
var aufbau_root = path.resolve('./')
var files_module_root = path.join(__dirname, '../')

// Set up the user data dir
var aufbau_files_user_dir = path.join(user_data_dir, 'aufbau-files')
var default_buckets = path.join(__dirname, '../', 'default-buckets.json')

if (!io.existsSync(aufbau_files_user_dir)) {
  io.fs.mkdirSync(aufbau_files_user_dir)
} 

var buckets_info_path = path.join(aufbau_files_user_dir, 'buckets.json')
if (!io.existsSync(buckets_info_path)){
  io.writeDataSync(buckets_info_path, io.readDataSync(default_buckets));
}

var buckets = io.readDataSync(buckets_info_path)
// This will store our retrieved file list
var bucket_results
var tmp_dir = path.join(files_module_root, 'tmp')

// For writing out files from smb
var streamifier = require('streamifier')
var mime = require('mime');

function connectToShare(){
  // smb connection details
  var secrets = io.readDataSync(path.join(aufbau_root, 'aufbau-files-secrets.json'))
  
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

// var clearTmpDir_once = _.once(clearTmpDir)
// Clear tmp dir on load
clearTmpDir()

// Templates for location types
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
buckets.forEach(function(bucketInfo, index){
  q.defer(bakeBucket, bucketInfo, index)
})

q.awaitAll(function(err, results){
  bucket_results = results
  bakeFiles()
})

// Listen for submission
var d3_add_bucket_form = d3.select('form#add-bucket')
d3_add_bucket_form.on('submit', addBucket)

function bakeBucket(bucketInfo, idx, cb){
  var loc_name = bucketInfo.name
  location_types[bucketInfo.type].getFiles(bucketInfo.dir, function(result){
    cb(null, {result: result, index: idx, bucketInfo: bucketInfo})
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
  bakeBucket(bucket_info, buckets.length, function(err, bucketResult) {
    bucket_results.push(bucketResult)
    bakeFiles()

    buckets.push(bucket_info)
    saveBucketList()
    clearBucketForm()
  })
}

function removeBucketAtIndex(idx){
  buckets = buckets.filter(function(bkt, index){
    return index != idx
  })
  bucket_results = bucket_results.filter(function(bkt, index){
    return index != idx
  })

  saveBucketList()
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

function removeBucketElAtIndex(idx){
  d3.select('#main').selectAll('.location-group').each(function(d, index){
    if (index == idx) {
      d3.select(this).remove()
    }
  })
}

function getUploadAndTransfer(filesList, d){
  var smb2Client = connectToShare()
  var path_delimiter = '\\\\'
  for (var i = 0; i < filesList.length; i++) {
    var fileInfo = filesList[i]
    var file_data = io.fs.readFileSync(fileInfo.path)
    var remote_loc = [d.bucketInfo.dir, fileInfo.name].join(path_delimiter)
    smb2Client.writeFile(remote_loc, file_data, function (err) {
      if (err) throw err;
      var file_obj = {
        dir: d.bucketInfo.dir,
        fetch: true,
        name: fileInfo.name
      }
      d.result.push(file_obj)
      bakeFiles()
    });
  }
}


function bakeFiles () {
  var locations = d3.select('#main').selectAll('.location-group').data(bucket_results)

  _locations = locations.enter()

  var location_group = _locations.append('div')
      .attr('class', function(d){
        var classes = []
        if (d.bucketInfo.permanent) {
          classes.push('permanent')
        }
        if (d.result[0].fetch) {
          classes.push('fetch')
        }
        return classes.join(' ')
      })
      .classed('location-group', true)
  //     .on('dragenter', function(){
  //       console.log('enter', this, (Math.random()*10).toFixed(1))
  //       d3.event.preventDefault()
  //       d3.event.stopPropagation()
  //       d3.select(this).attr('data-drag', 'over')
  //     })
  //     .on('dragleave', function(){
  //       console.log('leave', this, (Math.random()*10).toFixed(1))
  //       d3.event.preventDefault()
  //       d3.event.stopPropagation()
  //       d3.select(this).attr('data-drag', 'leave')
  //     })
  //     .on('drop', function(){
  //       d3.event.preventDefault()
  //       d3.event.stopPropagation()
  //       d3.select(this).attr('data-drag', '')
  //       alert('hey')
  //     })

  // location_group.append('div')
  //   .classed('drag-hover', true)
  //   .html('Drop file')
  //   .on('dragleave', function(){
  //     d3.event.preventDefault()
  //     d3.event.stopPropagation()
  //   })

  var bucket_title = location_group.append('div')
    .classed('title', true)
    .html(function(d){
      return d.bucketInfo.name
    })
  
  bucket_title.append('span')
    .html(' 🚫')
    .classed('remove-bucket', true)
    .classed('location-option', true)
    .on('click', function(d){
      var idx = d.index // Remove the bucket json based on the index in case the name is not unique
      removeBucketAtIndex(idx)
      removeBucketElAtIndex(idx)
    })

  bucket_title.append('div')
    .classed('add-file', true)
    .html('<span class="icon">➕</span>')
    // .classed('location-option', true)
    .append('input')
      .attr('type', 'file')
      .attr('multiple', 'true')
      .on('change', function(d){
        getUploadAndTransfer(this.files, d)
      })

  var file_group = locations.selectAll('.file-group').data(function(d){
    return d.result
  }, function(d){
    return d.name
  }).enter()
    .append('a')
    .classed('file-group', true)
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
    // .on('dragleave', function(){
    //   d3.event.preventDefault()
    //   d3.event.stopPropagation()
    // })


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

  locations.selectAll('.file-group[data-share="true"]').on('click', function(d){
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

        // Turn our buffer into a stream
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

  // For every location group in our selection, add listeners
  // location_group.each(function(){
  //   this.addEventListener('dragenter', function(e){
  //     e.stopPropagation()
  //     e.preventDefault()
  //     d3.select(this).attr('data-drag', 'over')
  //   })

  //   this.addEventListener('dragleave', function(e){
  //     e.stopPropagation()
  //     e.preventDefault()
  //     d3.select(this).attr('data-drag', 'leave')
  //   })
  // })

  // location_group.node().addEventListener('dragleave', function(e){
  //   e.stopPropagation()
  //   e.preventDefault()
  //   d3.select(this).attr('data-drag', 'exit')
  // })
}
