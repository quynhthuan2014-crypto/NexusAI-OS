import { Provider } from './provider.js';

export class LLMProvider extends Provider {
  constructor({ baseUrl = process.env.LLM_BASE_URL || 'http://127.0.0.1:11434/v1', apiKey = process.env.LLM_API_KEY || 'ollama', model = process.env.LLM_MODEL || 'llama3' } = {}) {
    super();
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.model = model;
  }

  async analyze(context) {
    const taskPrompt = context.task?.prompt ?? '';
    const stage = context.stage ?? 'planner';

    if (stage === 'reviewer') {
      return {
        capability: `llm-${this.model}`,
        summary: 'LLM reviewer evaluated changes',
        reviewFindings: context.decision?.reviewFindings ?? []
      };
    }

    const systemPrompt = `You are NexusAI-OS LLM Provider. You must output ONLY valid JSON adhering strictly to this format:
{
  "summary": "Brief explanation of changes",
  "plan": ["step 1", "step 2"],
  "edits": [{"action": "writeFile", "path": "relative/path.txt", "content": "file content"}],
  "reviewFindings": [],
  "checks": [{"name": "check-name", "required": true, "path": "relative/path.txt", "contains": "expected string"}]
}`;

    const userPrompt = `Task: ${taskPrompt}\nProject Root: ${context.project?.root}\nPlease analyze and generate the structured engineering plan and edits.`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2
        })
      });

      if (!response.ok) {
        throw new Error(`LLM API error: HTTP ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? '';

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('llm-invalid-json-response');
      }

      const decision = JSON.parse(jsonMatch[0]);
      return {
        capability: `llm-${this.model}`,
        summary: decision.summary || 'LLM generated plan',
        plan: Array.isArray(decision.plan) ? decision.plan : [],
        edits: Array.isArray(decision.edits) ? decision.edits : [],
        reviewFindings: Array.isArray(decision.reviewFindings) ? decision.reviewFindings : [],
        checks: Array.isArray(decision.checks) ? decision.checks : []
      };
    } catch (error) {
      return {
        capability: `llm-${this.model}-fallback`,
        summary: `LLM analysis failed: ${error.message}`,
        plan: [],
        edits: [],
        reviewFindings: [{ id: 'llm_err', severity: 'blocking', message: error.message }],
        checks: []
      };
    }
  }
}
