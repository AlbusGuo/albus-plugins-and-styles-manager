import esbuild from 'esbuild';
import process from 'process';
import { builtinModules } from 'node:module';

const banner = `/*
This file was generated and bundled by esbuild.
Source: https://github.com/AlbusGuo/albus-plugins-and-styles-manager
*/
`;

const prod = process.argv[2] === 'production';

const context = await esbuild.context({
	banner: {
		js: banner,
	},
	entryPoints: ['src/main.ts'],
	bundle: true,
	external: [
		'obsidian',
		'electron',
		'@codemirror/autocomplete',
		'@codemirror/collab',
		'@codemirror/commands',
		'@codemirror/language',
		'@codemirror/lint',
		'@codemirror/search',
		'@codemirror/state',
		'@codemirror/view',
		'@lezer/common',
		'@lezer/highlight',
		'@lezer/lr',
		...builtinModules
	],
	format: 'cjs',
	target: 'es2018',
	logLevel: 'info',
	sourcemap: prod ? false : 'inline',
	treeShaking: true,
	outfile: 'main.js',
	minify: prod
});

// Build CSS separately from the source styles directory.
const cssContext = await esbuild.context({
	entryPoints: ['src/styles/index.css'],
	bundle: true,
	outfile: 'styles.css',
	minify: prod,
	logLevel: 'info'
});

if (prod) {
	await context.rebuild();
	await cssContext.rebuild();
	process.exit(0);
} else {
	await context.watch();
	await cssContext.watch();
}
