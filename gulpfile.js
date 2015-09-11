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

gulp.task('default', ['build']);

gulp.task('build', ['styles', 'design', 'javascript', 'favicons']);
gulp.task('clean', ['styles:clean', 'dist:clean', 'design:clean', 'javascript:clean', 'favicons:clean']);

gulp.task('design', ['design:build']);
gulp.task('design:build', ['design:clean'], function() {
	var stream = streamqueue({ objectMode: true });

	stream.queue(
		gulp.src(['./web/src/Design/**/*.{png,jpg,jpeg,gif}'])
			.pipe(imagemin({
				progressive: true
			}))
	);

	stream.queue(
		gulp.src(['./web/src/Design/**/*', '!./web/src/Design/**/*.{png,jpg,jpeg,gif}'])
	);

	return stream.done()
		.pipe(gulp.dest('./web/build/Design'));
});
gulp.task('design:clean', function(callback) {
	del(['./web/build/Design'], callback);
});

gulp.task('styles', ['styles:live-edit']);
gulp.task('styles:live-edit', ['styles:build'], function() {
	return gulp.src('./web/build/Stylesheets/LiveEdit/app.css')
		.pipe(vinylPaths(del))
		.pipe(gulp.dest('./LiveEdit/'));
});
gulp.task('styles:build', ['styles:clean'], function () {
	return gulp.src('./web/src/Stylesheets/**/*.scss')
		.pipe(sass({
			outputStyle: 'expanded'
		}))
		.pipe(autoprefixer({
			browsers: ['> 1%', 'last 2 versions', 'ie >= 9'],
			cascade: false
		}))
		.pipe(gulp.dest('./web/build/Stylesheets'));
});
gulp.task('styles:clean', function(callback) {
	del(['./web/build/Stylesheets'], callback);
});

gulp.task('javascript', ['javascript:build']);
gulp.task('javascript:build', ['javascript:clean'], function() {
	return gulp.src('./web/src/Javascript/**/*.js')
		.pipe(gulp.dest('./web/build/Javascript'));
});
gulp.task('javascript:clean', function(callback) {
	del(['./web/build/Javascript'], callback);
});

gulp.task('favicons', ['favicons:build']);
gulp.task('favicons:build', ['favicons:clean'], function() {
	return gulp.src('./web/src/FavIcons/**/*')
		.pipe(gulp.dest('./web/build/FavIcons'));
});
gulp.task('favicons:clean', function(callback) {
	del(['./web/build/FavIcons'], callback);
});

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

gulp.task('dist', ['dist:build', 'build']);
gulp.task('dist:build', ['dist:clean'], function() {
	var stream = streamqueue({ objectMode: true });

	stream.queue(
		gulp.src('./config/manifest.json')
	);

	stream.queue(
		gulp.src('./web/build/Design/**/*', {base: './web/build'})
			.pipe(rename(function(path) {
				path.dirname = path.dirname.replace('Design', 'Design\\Neptune');
			}))
	);

	stream.queue(
		gulp.src('./web/build/Javascript/**/*', {base: './web/build'})
			.pipe(rename(function(path) {
				path.dirname = path.dirname.replace('Javascript', 'Javascript\\Neptune');
			}))
	);

	stream.queue(
		gulp.src('./web/build/Stylesheets/**/*', {base: './web/build'})
			.pipe(rename(function(path) {
				path.dirname = path.dirname.replace('Stylesheets', 'Stylesheets\\Neptune');
			}))
	);

	return stream.done()
		.pipe(zip('theme.zip'))
		.pipe(gulp.dest('./dist/'));
});
gulp.task('dist:clean', function(callback) {
	del(['./dist'], callback);
});