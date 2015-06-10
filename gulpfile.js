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

gulp.task('default', ['clean', 'styles']);

gulp.task('clean', ['clean:styles', 'clean:dist']);
gulp.task('clean:styles', function(cb) {
	del(['./Stylesheets/build/**'], cb);
});
gulp.task('clean:dist', function(cb) {
	del(['./dist/**'], cb);
});

gulp.task('styles:build', ['clean:styles'], function () {
	return gulp.src('./Stylesheets/src/**/*.scss')
		.pipe(sass({
			outputStyle: 'expanded'
		}))
		.pipe(autoprefixer({
			browsers: ['> 1%', 'last 2 versions', 'ie >= 9'],
			cascade: false
		}))
		.pipe(gulp.dest('./Stylesheets/build'));
});

gulp.task('styles', ['live-edit:build']);

gulp.task('iconfont', function(){
	return gulp.src('./FontGlyphs/src/icons/*.svg')
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

			gulp.src('./FontGlyphs/src/templates/_iconfont.scsstpl')
				.pipe(consolidate('lodash', {
					glyphs: codepoints
				}))
				.pipe(rename('_font-glyph-entities.scss'))
				.pipe(gulp.dest('./Stylesheets/src/Neptune/Config/'));
		})
		.pipe(gulp.dest('./Design/Neptune/Fonts/GlyphLib/'));
});

gulp.task('live-edit:build', ['styles:build'], function() {
	return gulp.src('./Stylesheets/build/Neptune/LiveEdit/app.css')
		.pipe(gulp.dest('./LiveEdit/'));
});

gulp.task('dist', ['clean:dist', 'live-edit:build'], function() {
	var stream = streamqueue({ objectMode: true });

	stream.queue(
		gulp.src('./config/manifest.json')
	);

	stream.queue(
		gulp.src('./Design/**/*', {base: '.'})
	);

	stream.queue(
		gulp.src('./Javascript/**/*', {base: '.'})
	);

	stream.queue(
		gulp.src('./Stylesheets/build/**/*', {base: '.'})
			.pipe(rename({
				dirname: 'Stylesheets/Neptune'
			}))
	);

	return stream.done()
		.pipe(zip('theme.zip'))
		.pipe(gulp.dest('./dist/'));
});