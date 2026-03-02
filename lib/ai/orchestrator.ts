import { getAdapter, type AIProvider } from './registry';
import type { ChatMessage } from './types';

// Master AI is instructed to use this syntax when delegating
const DELEGATE_REGEX = /\[DELEGATE:\s*(.*?)\]/g;

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

const MASTER_SYSTEM_PROMPT = `You are the Master AI Orchestrator in a multi-agent AI system. You are working with slave AI agents that you can delegate specific sub-tasks to.

When you need a slave AI to answer a specific sub-question or perform a focused task, use this exact syntax:
[DELEGATE: your specific question or task here]

You can use multiple DELEGATE calls. After receiving slave responses, synthesize everything into a comprehensive final answer for the user.

Available slaves: {SLAVE_LIST}

Be strategic: delegate tasks that benefit from another AI's specific strengths. Synthesize slave answers into your final response.`;

export async function* runOrchestration(
    ctx: OrchestrationContext
): AsyncIterable<OrchestrationStep> {
    const {
        masterProvider,
        masterApiKey,
        masterModel,
        slaves,
        userQuery,
        conversationHistory,
        onStep,
    } = ctx;

    const masterAdapter = getAdapter(masterProvider);
    const slaveList = slaves.map((s) => s.provider).join(', ');

    const systemPrompt = MASTER_SYSTEM_PROMPT.replace('{SLAVE_LIST}', slaveList);

    // Build messages for master
    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userQuery },
    ];

    // Phase 1: Get master's initial thinking / delegation requests
    const masterThinking = await masterAdapter.chat(messages, masterApiKey, masterModel);

    const thinkingStep: OrchestrationStep = {
        type: 'thinking',
        provider: masterProvider,
        content: masterThinking,
    };
    onStep(thinkingStep);
    yield thinkingStep;

    // Phase 2: Detect delegation requests and run slaves
    const delegations: Array<{ question: string; provider: AIProvider; answer: string }> = [];
    const matches = [...masterThinking.matchAll(DELEGATE_REGEX)];

    for (const match of matches) {
        const question = match[1].trim();
        // Round-robin or assign to first slave if only one
        const slave = slaves[delegations.length % slaves.length];

        const delegationStep: OrchestrationStep = {
            type: 'delegation',
            provider: masterProvider,
            delegateTo: slave.provider,
            question,
            content: question,
        };
        onStep(delegationStep);
        yield delegationStep;

        // Run the slave
        const slaveAdapter = getAdapter(slave.provider);
        const slaveMessages: ChatMessage[] = [
            {
                role: 'system',
                content: `You are a specialized AI assistant. Answer the following question concisely and precisely. You are working as part of a multi-agent system where your answer will be used by a master AI.`,
            },
            { role: 'user', content: question },
        ];

        const slaveAnswer = await slaveAdapter.chat(slaveMessages, slave.apiKey, slave.model);

        const slaveStep: OrchestrationStep = {
            type: 'slave_response',
            provider: slave.provider,
            content: slaveAnswer,
            question,
        };
        onStep(slaveStep);
        yield slaveStep;

        delegations.push({ question, provider: slave.provider, answer: slaveAnswer });
    }

    // Phase 3: Feed slave answers back to master for synthesis
    let synthesisMessages: ChatMessage[] = [...messages];

    if (delegations.length > 0) {
        const slaveContext = delegations
            .map(
                (d, i) =>
                    `Slave response ${i + 1} (${d.provider}) to "${d.question}":\n${d.answer}`
            )
            .join('\n\n---\n\n');

        synthesisMessages = [
            ...messages,
            { role: 'assistant', content: masterThinking },
            {
                role: 'user',
                content: `Here are the slave AI responses to your delegated questions:\n\n${slaveContext}\n\nNow provide a comprehensive, synthesized final answer to the user's original question: "${userQuery}"`,
            },
        ];
    }

    // Stream the final synthesis
    const finalChunks: string[] = [];
    for await (const chunk of masterAdapter.streamChat(
        synthesisMessages,
        masterApiKey,
        masterModel
    )) {
        finalChunks.push(chunk);
        const streamStep: OrchestrationStep = {
            type: 'final',
            provider: masterProvider,
            content: chunk,
        };
        onStep(streamStep);
        yield streamStep;
    }
}
