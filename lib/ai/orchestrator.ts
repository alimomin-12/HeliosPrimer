import { getAdapter, type AIProvider } from './registry';
import type { ChatMessage } from './types';

// Master AI is instructed to use this syntax when delegating
const DELEGATE_REGEX = /\[DELEGATE:\s*([\s\S]*?)\]/g;

// Strip any [DELEGATE: ...] blocks from text (prevents feedback loop in history)
function stripDelegateTags(text: string): string {
    return text.replace(DELEGATE_REGEX, '').replace(/\n{3,}/g, '\n\n').trim();
}

export interface OrchestrationStep {
    type: 'thinking' | 'delegation' | 'slave_response' | 'final';
    provider: AIProvider;
    content: string;
    delegateTo?: AIProvider;
    question?: string;
}

export interface OrchestrationContext {
    masterProvider: AIProvider;
    masterApiKey: string;
    masterModel: string;
    slaves: Array<{
        provider: AIProvider;
        apiKey: string;
        model: string;
    }>;
    userQuery: string;
    conversationHistory: ChatMessage[];
    onStep: (step: OrchestrationStep) => void;
}

// Phase 1: planning — master MUST issue [DELEGATE] calls. Very explicit for all AI providers.
const MASTER_PLAN_PROMPT = `You are the Master AI Orchestrator. You MUST coordinate with slave AI agents by delegating sub-tasks to them. This is required.

YOUR ONLY JOB IN THIS STEP is to issue delegation calls to your slave AIs. Use this EXACT syntax for each delegation (including the square brackets):
[DELEGATE: the specific question or task you want the slave AI to research]

MANDATORY RULES:
1. You MUST issue at least one [DELEGATE: ...] call — no exceptions.
2. Break the user's question into focused sub-tasks and delegate each one.
3. Do NOT write a full answer here — only output [DELEGATE: ...] lines.
4. You WILL write the complete final answer in the next step after receiving slave responses.

Available slave AIs: {SLAVE_LIST}

Example of correct output:
[DELEGATE: What are the main advantages of X?]
[DELEGATE: What are the main disadvantages of X?]

Now issue your delegation calls for the user's question:`;

// Phase 3: final synthesis — delegation completely banned
const MASTER_SYNTHESIS_PROMPT = `You are an expert AI assistant providing a comprehensive final answer.

RULES:
- Answer the user's question directly and thoroughly.
- Do NOT use [DELEGATE: ...] syntax — that phase is over.
- Do NOT mention orchestration, slaves, or multi-agent systems in your answer.
- Incorporate any research provided to you naturally, as if you researched it yourself.
- Be well-structured, clear, and helpful.`;

export async function* runOrchestration(
    ctx: OrchestrationContext
): AsyncIterable<OrchestrationStep> {
    const { masterProvider, masterApiKey, masterModel, slaves, userQuery, conversationHistory, onStep } = ctx;

    const masterAdapter = getAdapter(masterProvider);
    const slaveList = slaves.map((s) => `${s.provider} (${s.model})`).join(', ');

    // Sanitize history: strip any [DELEGATE] tags from previous assistant messages
    const cleanHistory: ChatMessage[] = conversationHistory.map((m) =>
        m.role === 'assistant' ? { ...m, content: stripDelegateTags(m.content) } : m
    );

    // ─── Phase 1: Force delegation planning ───────────────────────────────────
    const planMessages: ChatMessage[] = [
        { role: 'system', content: MASTER_PLAN_PROMPT.replace('{SLAVE_LIST}', slaveList) },
        // Do NOT include history in the planning phase — it confuses the master
        // into thinking it already has context and skips delegation
        { role: 'user', content: userQuery },
    ];

    const masterThinking = await masterAdapter.chat(planMessages, masterApiKey, masterModel);

    const thinkingStep: OrchestrationStep = { type: 'thinking', provider: masterProvider, content: masterThinking };
    onStep(thinkingStep);
    yield thinkingStep;

    // ─── Phase 2: Execute slave delegations ───────────────────────────────────
    const delegations: Array<{ question: string; provider: AIProvider; answer: string }> = [];
    const matches = [...masterThinking.matchAll(DELEGATE_REGEX)];

    // Fallback: if the master ignored the [DELEGATE] instruction and answered directly,
    // treat the original user question as the single delegation task
    const delegateItems = matches.length > 0
        ? matches.map((m) => m[1].trim())
        : [userQuery]; // fallback: delegate the full query to the slave

    for (let i = 0; i < delegateItems.length; i++) {
        const question = delegateItems[i];
        const slave = slaves[i % slaves.length];

        const delegationStep: OrchestrationStep = {
            type: 'delegation', provider: masterProvider,
            delegateTo: slave.provider, question, content: question,
        };
        onStep(delegationStep);
        yield delegationStep;

        const slaveAdapter = getAdapter(slave.provider);
        const slaveMessages: ChatMessage[] = [
            {
                role: 'system',
                content: `You are a precise research assistant. Answer the following question thoroughly. Your answer will be used as research input by a master AI to compose a final response.`,
            },
            { role: 'user', content: question },
        ];

        const slaveAnswer = await slaveAdapter.chat(slaveMessages, slave.apiKey, slave.model);

        const slaveStep: OrchestrationStep = {
            type: 'slave_response', provider: slave.provider, content: slaveAnswer, question,
        };
        onStep(slaveStep);
        yield slaveStep;

        delegations.push({ question, provider: slave.provider, answer: slaveAnswer });
    }

    // ─── Phase 3: Final synthesis (delegation banned) ──────────────────────────
    const researchContext = delegations.length > 0
        ? `Here is the research gathered from slave AI agents:\n\n` +
        delegations.map((d, i) =>
            `[Source ${i + 1}: ${d.provider}]\nQuestion: ${d.question}\nAnswer: ${d.answer}`
        ).join('\n\n---\n\n') +
        `\n\n---\n\nUsing the above research, write a comprehensive answer to the user's original question: "${userQuery}"`
        : `Answer the user's question: "${userQuery}"`;

    const synthesisMessages: ChatMessage[] = [
        { role: 'system', content: MASTER_SYNTHESIS_PROMPT },
        ...cleanHistory,
        { role: 'user', content: researchContext },
    ];

    for await (const chunk of masterAdapter.streamChat(synthesisMessages, masterApiKey, masterModel)) {
        // Strip any accidental [DELEGATE] tokens from synthesis output
        const cleanChunk = chunk.replace(DELEGATE_REGEX, '');
        if (!cleanChunk) continue;

        const streamStep: OrchestrationStep = { type: 'final', provider: masterProvider, content: cleanChunk };
        onStep(streamStep);
        yield streamStep;
    }
}
