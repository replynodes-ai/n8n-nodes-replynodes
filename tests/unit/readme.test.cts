import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { findOperation } from '../../nodes/ReplyNodes/operations';

const NODE_TYPE = '@replynodes/n8n-nodes-replynodes.replyNodes';

interface WorkflowNode {
	name: string;
	type: string;
	typeVersion: number;
	parameters: Record<string, unknown>;
}

test('README example workflows parse and use real operations with their required fields', () => {
	const readme = readFileSync('README.md', 'utf8');
	const blocks = [...readme.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]);
	assert.ok(blocks.length >= 3, 'at least three examples');

	for (const block of blocks) {
		const workflow = JSON.parse(block) as {
			nodes: WorkflowNode[];
			connections: Record<string, { main: Array<Array<{ node: string }>> }>;
		};
		const names = new Set(workflow.nodes.map((n) => n.name));
		for (const [from, outputs] of Object.entries(workflow.connections)) {
			assert.ok(names.has(from), `connection from unknown node ${from}`);
			for (const target of outputs.main.flat()) {
				assert.ok(names.has(target.node), `connection to unknown node ${target.node}`);
			}
		}
		for (const node of workflow.nodes.filter((n) => n.type === NODE_TYPE)) {
			assert.equal(node.typeVersion, 1);
			const { resource, operation } = node.parameters as { resource: string; operation: string };
			const definition = findOperation(resource, operation);
			assert.ok(definition, `${node.name}: unknown operation ${resource}/${operation}`);
			for (const field of (definition.fields ?? []).filter((f) => f.required)) {
				assert.ok(node.parameters[field.name], `${node.name}: missing ${field.name}`);
			}
		}
	}
});
