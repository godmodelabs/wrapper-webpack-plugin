/* fix based on
 * https://github.com/levp/wrapper-webpack-plugin/issues/11#issuecomment-708215938
 * and https://github.com/webpack/webpack-sources/issues/92#issuecomment-709601572
 */
'use strict';

const ModuleFilenameHelpers = require("webpack/lib/ModuleFilenameHelpers");
var offsetLines = require('offset-sourcemap-lines');

class WrapperPlugin {

	/**
	 * @param {Object} args
	 * @param {string | Function} [args.header]  Text that will be prepended to an output file.
	 * @param {string | Function} [args.footer] Text that will be appended to an output file.
	 * @param {string | RegExp} [args.test] Tested against output file names to check if they should be affected by this
	 * plugin.
	 * @param {boolean} [args.afterOptimizations=false] Indicating whether this plugin should be activated before
	 * (`false`) or after (`true`) the optimization stage. Example use case: Set this to true if you want to avoid
	 * minification from affecting the text added by this plugin.
	 */
	constructor(args) {
		if (typeof args !== 'object') {
			throw new TypeError('Argument "args" must be an object.');
		}

		this.header = args.hasOwnProperty('header') ? args.header : '';
		this.footer = args.hasOwnProperty('footer') ? args.footer : '';
		this.afterOptimizations = args.hasOwnProperty('afterOptimizations') ? !!args.afterOptimizations : false;
		this.test = args.hasOwnProperty('test') ? args.test : '';
	}

	apply(compiler) {
		const header = this.header;
		const footer = this.footer;
		const tester = {test: this.test};

		compiler.hooks.thisCompilation.tap('WrapperPlugin', (compilation) => {
			// webpack 5: use new processAssets
			compilation.hooks.processAssets.tap(
				{
					name: 'WrapperPlugin',
					stage: compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
				},
				(chunks) => wrapChunks(compilation, chunks),
			);
		});

		function wrapFile(compilation, fileName, chunkHash) {
			const headerContent = (typeof header === 'function') ? header(fileName, chunkHash) : header;
			const footerContent = (typeof footer === 'function') ? footer(fileName, chunkHash) : footer;

			const {source, map} = compilation.getAsset(fileName).source.sourceAndMap();
			const wrappedSource = new compiler.webpack.sources.ConcatSource(
				String(headerContent),
				source.toString(),
				String(footerContent),
			);
			if (map) {
				const offset = headerContent.split(/\r\n|\r|\n/).length - 1;
				const offsetMap = offsetLines(map, offset);

				const sourceWithMap = new compiler.webpack.sources.SourceMapSource(
					wrappedSource.source().toString(),
					fileName,
					offsetMap,
					source,
					map,
					false
				);
				compilation.updateAsset(fileName, sourceWithMap);
			} else {
				compilation.updateAsset(fileName, wrappedSource);
			}
		}

		function wrapChunks(compilation, chunks) {
			Object.keys(chunks).forEach(fileName => {
				if (ModuleFilenameHelpers.matchObject(tester, fileName)) {
					wrapFile(compilation, fileName, compilation.hash);
				}
			});
		}
	}
}

module.exports = WrapperPlugin;
