module.exports = function(grunt) {

	grunt.initConfig({
		webfont: {
			icons: {
				src: 'src/icons/*.svg',
				dest: 'build/fonts',
				options: {
					font: 'neptune-glyph-font',
					syntax: 'bootstrap',
					engine: 'node',
					startCodepoint: 0xF101,
					stylesheet: 'scss',
					fontHeight: 150
				}
			}
		},
		copy: {
			main: {
				src: 'build/fonts/_neptune-glyph-font.scss',
				dest: '../Stylesheets/src/Neptune/Config/_font-glyph-entities.scss',
				options: {
					process: function (content, srcpath) {
						//Replace all the extra content and change the CSS to named SCSS variables that reference the unicode content
						content = content.replace(new RegExp('[\\s\\S]+?// Icons'), '');
						content = content.replace(new RegExp('.icon-(.*):before\\s\\{\\S*\\s*content:(".*");\\S*\\s}', 'g'), '\$html-entity-$1: $2;');
						return content.replace(/(\r\n|\r|\n)+/g, '$1');
					}
				}
			},
			fonts: {
				src: ['build/fonts/*', '!build/fonts/*.{scss,css,html}'],
				dest: '../Design/Neptune/Fonts/GlyphLib/',
				expand: true,
				flatten: true
			}
		}
	});

	grunt.loadNpmTasks('grunt-webfont');
	grunt.loadNpmTasks('grunt-contrib-copy');

	grunt.registerTask('default', ['webfont', 'copy']);

};