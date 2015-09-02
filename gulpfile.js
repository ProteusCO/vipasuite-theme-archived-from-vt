var _ = require('underscore');
var gulp = require('gulp');
var sass = require('gulp-sass');
var autoprefixer = require('gulp-autoprefixer');
var iconfont = require('gulp-iconfont');
var consolidate = require('gulp-consolidate');
var rename = require('gulp-rename');
var del = require('del');
var zip = require('gulp-zip');
var streamqueue = require('streamqueue');
var vinylPaths = require('vinyl-paths');
var imagemin = require('gulp-imagemin');

gulp.task('default', ['clean', 'styles']);

gulp.task('clean', ['clean:styles', 'clean:dist']);
gulp.task('styles:clean', function(cb) {
	del(['./web/Stylesheets/build/**'], cb);
});
gulp.task('dist:clean', function(cb) {
	del(['./dist/**'], cb);
});

gulp.task('design:optimize', function() {
	return gulp.src(['./web/Design/**/*.{png,jpg,jpeg,gif}'])
		.pipe(imagemin({
			progressive: true
		}))
		.pipe(gulp.dest('./web/Design/build'));
});

gulp.task('styles:build', ['styles:clean'], function () {
	return gulp.src('./web/Stylesheets/src/**/*.scss')
		.pipe(sass({
			outputStyle: 'expanded'
		}))
		.pipe(autoprefixer({
			browsers: ['> 1%', 'last 2 versions', 'ie >= 9'],
			cascade: false
		}))
		.pipe(gulp.dest('./web/Stylesheets/build'));
});

gulp.task('styles', ['live-edit:build']);

gulp.task('iconfont', function(){
	return gulp.src('./fontglyphs/src/icons/*.svg')
		.pipe(iconfont({
			fontName: 'neptune-glyph-font', // required
			appendCodepoints: true, // recommended option
			startCodepoint: 0xF101,
			fontHeight: 150
		}))
		.on('codepoints', function(codepoints, options) {
			codepoints = _.map(codepoints, function(codepoint) {
				return {
					name: codepoint.name,
					codepoint: codepoint.codepoint.toString(16).toLowerCase()
				};
			});

			gulp.src('./fontglyphs/src/templates/_iconfont.scsstpl')
				.pipe(consolidate('lodash', {
					glyphs: codepoints
				}))
				.pipe(rename('_font-glyph-entities.scss'))
				.pipe(gulp.dest('./web/Stylesheets/src/Neptune/Config/'));
		})
		.pipe(gulp.dest('./web/Design/Neptune/Fonts/GlyphLib/'));
});

gulp.task('live-edit:build', ['styles:build'], function() {
	return gulp.src('./web/Stylesheets/build/Neptune/LiveEdit/app.css')
		.pipe(vinylPaths(del))
		.pipe(gulp.dest('./liveedit/'));
});

gulp.task('dist', ['dist:clean', 'styles'], function() {
	var stream = streamqueue({ objectMode: true });

	stream.queue(
		gulp.src('./config/manifest.json')
	);

	stream.queue(
		gulp.src('./web/Design/**/*', {base: './web'})
	);

	stream.queue(
		gulp.src('./web/Javascript/**/*', {base: './web'})
	);

	stream.queue(
		gulp.src('./web/Stylesheets/build/**/*', {base: './web'})
			.pipe(rename(function(path) {
				path.dirname = path.dirname.replace('\\build', '');
			}))
	);

	return stream.done()
		.pipe(zip('theme.zip'))
		.pipe(gulp.dest('./dist/'));
});