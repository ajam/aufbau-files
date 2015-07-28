var gulp = require('gulp');
var nib = require('nib')
var plumber = require('gulp-plumber')
var stylus = require('gulp-stylus')
 
var paths = {
  css: 'src/css/*.styl'
}

// styles
gulp.task('styles', function() {
  gulp.src(paths.css)
    .pipe(plumber())
    .pipe(stylus({
      use: nib()
    }))
    .pipe(gulp.dest('src/css/'));
});


gulp.task('watch', function() {
  gulp.watch(paths.css, ['styles'])
});


gulp.task('default', ['styles']); 

gulp.task('watch-files', ['watch', 'styles']); 