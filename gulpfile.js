var _ = require('underscore');
var gulp = require('gulp');
var sass = require('gulp-sass');
var autoprefixer = require('gulp-autoprefixer');
var iconfont = require('gulp-iconfont');
var consolidate = require('gulp-consolidate');
var rename = require('gulp-rename');
var merge = require('merge-stream');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var browserify = require('browserify');
var bulkify = require('bulkify');


gulp.task('default', ['styles']);

gulp.task('styles', function () {
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

gulp.task('live-edit', function() {
	return gulp.src('./Stylesheets/build/Neptune/LiveEdit/app.css')
		.pipe(gulp.dest('./LiveEdit/'));
});

gulp.task('javascript', function() {
	var tasks = [];
	var BASE_SRC_DIR = './Javascript/src/Neptune';
	var BASE_BUILD_DIR = './Javascript/build/Neptune';

	function jsSrcPath(path) {
		return BASE_SRC_DIR + path;
	}

	function jsBuildPath(path) {
		return BASE_BUILD_DIR + path;
	}

	var simpleCopy = gulp.src(jsSrcPath('/simple/**/*.js'))
		.pipe(gulp.dest(jsBuildPath('/simple')));


	var cogsworthReportingUiBrowserify = browserify({
		entries: jsSrcPath('/complex/cogsworth/reporting.module.js'),
		debug: true,
		transform: [bulkify]
	});

	var cogsworthReportingUi = cogsworthReportingUiBrowserify.bundle()
		.pipe(source('reporting.bundle.js'))
		.pipe(buffer())
		.pipe(gulp.dest(jsBuildPath('/complex/cogsworth')));


	tasks.push(simpleCopy);
	tasks.push(cogsworthReportingUi);

	return merge(tasks);
});