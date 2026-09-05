import { Provider } from './provider.js';

export class LocalProvider extends Provider {
  async analyze(context) {
    const task = String(context.task?.prompt ?? '');
    if (!task.startsWith('DEMO:')) {
      return {
        capability: 'external-provider-required',
        summary: 'The deterministic provider only executes safe DEMO tasks. Configure a legitimate model provider for general natural-language coding tasks.',
        plan: [], edits: [], reviewFindings: [], checks: []
      };
    }
    return {
      capability: 'local-demo',
      summary: 'Create a deterministic artifact, review the change, then verify the file.',
      plan: ['Create .nexusai/demo-output.txt', 'Review generated content', 'Verify artifact exists and contains the expected marker'],
      edits: [{ action: 'writeFile', path: '.nexusai/demo-output.txt', content: 'NexusAI-OS verified demo artifact.\n' }],
      reviewFindings: [],
      checks: [{ name: 'demo-artifact', required: true, path: '.nexusai/demo-output.txt', contains: 'verified demo artifact' }]
    };
  }
}
