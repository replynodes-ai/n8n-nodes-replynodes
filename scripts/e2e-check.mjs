// Checks the output of `n8n execute --rawOutput` and n8n's node type list in the e2e workflow.
// Usage:
//   node scripts/e2e-check.mjs types <nodes.json> <workflow.json>...
//   node scripts/e2e-check.mjs free <execution-output>
//   node scripts/e2e-check.mjs keyed <execution-output>
//   node scripts/e2e-check.mjs recipe <name> <execution-output>
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const [mode, ...args] = process.argv.slice(2);

function readExecution(path) {
	const text = readFileSync(path, 'utf8');
	const start = text.indexOf('{');
	assert.ok(start >= 0, `${path}: no JSON in n8n output:\n${text.slice(0, 2000)}`);
	const run = JSON.parse(text.slice(start));
	assert.equal(run.data.resultData.error, undefined, 'workflow failed');
	return run.data.resultData.runData;
}

function items(runData, node) {
	const runs = runData[node];
	assert.ok(runs, `node "${node}" did not run`);
	assert.equal(
		runs[0].error,
		undefined,
		`node "${node}" errored: ${JSON.stringify(runs[0].error)}`,
	);
	return runs[0].data.main[0];
}

function ok(label) {
	console.log(`ok  ${label}`);
}

if (mode === 'types') {
	const [typesPath, ...workflows] = args;
	const list = JSON.parse(readFileSync(typesPath, 'utf8'));
	const known = new Map();
	for (const type of list) {
		const versions = Array.isArray(type.version) ? type.version : [type.version];
		known.set(type.name, [...(known.get(type.name) ?? []), ...versions]);
	}
	// Nodes loaded from n8n's custom folder are registered as CUSTOM.<name>.
	for (const name of ['CUSTOM.replyNodes', 'CUSTOM.replyNodesTool']) {
		assert.ok(known.has(name), `${name} is not registered`);
		ok(`registered: ${name}`);
	}
	let failed = false;
	for (const file of workflows) {
		const workflow = JSON.parse(readFileSync(file, 'utf8'));
		for (const node of workflow.nodes) {
			const versions = known.get(node.type);
			if (!versions || !versions.includes(node.typeVersion)) {
				failed = true;
				console.log(
					`BAD ${file}: ${node.name} uses ${node.type}@${node.typeVersion}; available: ${versions ? versions.join(', ') : 'none'}`,
				);
			}
		}
		if (!failed) ok(`types and versions valid: ${file}`);
	}
	process.exit(failed ? 1 : 0);
}

if (mode === 'free') {
	const run = readExecution(args[0]);

	const [brand] = items(run, 'Get Brand');
	assert.equal(brand.json.domain, 'n8n.io');
	ok('Get Brand: URL input reduced to n8n.io');

	const [logo] = items(run, 'Get Logo Image');
	assert.match(logo.binary.data.mimeType, /^image\//);
	assert.equal(logo.json.fileName, logo.binary.data.fileName);
	ok(`Get Logo Image: binary ${logo.binary.data.mimeType} ${logo.json.fileName}`);

	const [md] = items(run, 'URL to Markdown');
	assert.equal(md.json.url, 'https://example.com/');
	assert.match(md.json.markdown, /^---/);
	ok(`URL to Markdown: ${md.json.markdown.length} chars with front matter`);

	const [kit] = items(run, 'Get Logo Kit');
	assert.ok(kit.json.data, 'logo kit envelope');
	ok('Get Logo Kit: anonymous call');

	const [search] = items(run, 'Search');
	assert.ok(Array.isArray(search.json.data.data) && search.json.data.data.length > 0);
	ok(`Search: ${search.json.data.data.length} results anonymously`);

	const [scrape] = items(run, 'Scrape');
	assert.equal(typeof scrape.json.data.markdown, 'string');
	ok('Scrape: anonymous call');

	const [crawl] = items(run, 'Crawl Without Key');
	assert.match(crawl.json.error, /needs a ReplyNodes API key/);
	ok('Crawl Site without a key: clear error item');

	const [invalid] = items(run, 'Invalid Domain');
	assert.match(invalid.json.error, /not a valid domain/);
	ok('Invalid domain: clear error item');
	process.exit(0);
}

if (mode === 'keyed') {
	const run = readExecution(args[0]);
	for (const node of [
		'Get Fonts',
		'Get Styleguide',
		'Search Brands',
		'Map Site',
		'Crawl Site',
		'Search With Key',
		'Get Brand With Key Set',
	]) {
		const [item] = items(run, node);
		assert.equal(item.json.error, undefined, `${node}: ${item.json.error}`);
		ok(`${node}: ${Object.keys(item.json).join(', ')}`);
	}
	process.exit(0);
}

if (mode === 'recipe') {
	const [name, path] = args;
	const run = readExecution(path);
	if (name === 'url-to-markdown') {
		const output = items(run, 'URL to Markdown');
		assert.equal(output.length, 2);
		for (const item of output) assert.ok(item.json.markdown.length > 0);
	} else if (name === 'brand-lookup') {
		assert.equal(items(run, 'Get Brand').length, 2);
		assert.ok(items(run, 'Get Logo Image').every((item) => item.binary?.data));
	} else if (name === 'competitor-research') {
		const pages = items(run, 'Read Page');
		assert.ok(pages.length > 0 && pages.length <= 3);
		assert.ok(items(run, 'Get Brand').length === pages.length);
	} else {
		throw new Error(`unknown recipe ${name}`);
	}
	ok(`recipe ran: ${name}`);
	process.exit(0);
}

console.error(`unknown mode ${mode}`);
process.exit(2);
