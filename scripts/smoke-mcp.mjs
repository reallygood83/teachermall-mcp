import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const expectedTools = [
  'search_products',
  'get_best_sellers',
  'get_product_details',
  'recommend_for_lesson',
  'build_classroom_kit',
  'generate_semester_preparation_list',
  'optimize_within_budget',
  'create_shopping_list_from_text',
  'clear_cache',
];

const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/index.js'],
  stderr: 'pipe',
});

const client = new Client({ name: 'teachermall-smoke', version: '0.1.0' });

try {
  await client.connect(transport);
  const result = await client.listTools();
  const names = result.tools.map(tool => tool.name).sort();

  assert.deepEqual(names, [...expectedTools].sort());
  console.log(`MCP smoke passed: ${names.length} tools exposed`);
} finally {
  await client.close();
}
