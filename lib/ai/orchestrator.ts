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
    researchMode?: boolean;
}

// ── STANDARD PROMPTS ──────────────────────────────────────────────────────────

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

const MASTER_SYNTHESIS_PROMPT = `You are an expert AI assistant providing a comprehensive final answer.

RULES:
- Answer the user's question directly and thoroughly.
- Do NOT use [DELEGATE: ...] syntax — that phase is over.
- Do NOT mention orchestration, slaves, or multi-agent systems in your answer.
- Incorporate any research provided to you naturally, as if you researched it yourself.
- Be well-structured, clear, and helpful.`;

// ── RESEARCH MODE PROMPTS ─────────────────────────────────────────────────────

const RESEARCH_MASTER_PLAN_PROMPT = `You are the Master Research Coordinator AI. Your role is to design a rigorous, multi-angle research plan and delegate each research angle to specialist slave AI agents.

YOUR ONLY JOB IN THIS STEP is to create a structured research agenda and issue precise delegation tasks using this EXACT syntax:
[DELEGATE: <specific factual research question with sourcing requirements>]

RESEARCH PLANNING RULES:
1. Decompose the user's topic into 3–6 distinct, non-overlapping research sub-questions.
2. Each delegation must ask for FACTS, DATA, STATISTICS, and CITATIONS — not opinions.
3. Cover multiple angles: background/history, current state, key evidence, counterpoints, expert consensus.
4. Specify that each delegate answer MUST include verifiable sources (research papers, official reports, authoritative publications).
5. Do NOT write any prose answer here — ONLY output [DELEGATE: ...] lines.
6. After all delegations are processed, you will synthesize a professional research document.

Available specialist agents: {SLAVE_LIST}

Example research delegation format:
[DELEGATE: What does peer-reviewed research say about X? Include specific study names, authors, publication years, and statistical findings.]
[DELEGATE: What are the documented historical origins and development timeline of X? Cite authoritative historical sources.]
[DELEGATE: What is the current scientific/expert consensus on X? Reference recent official reports, meta-analyses, or institutional statements with publication details.]

Now create your research plan and issue delegation tasks for the topic:`;

const RESEARCH_SLAVE_PROMPT = `You are a specialist Research Agent. Your role is to provide highly accurate, factual, citation-backed responses.

CRITICAL REQUIREMENTS:
1. ACCURACY: Only state facts you can confirm. Do not speculate or extrapolate.
2. CITATIONS: For every claim, provide the source in this format: (Author/Organisation, Year) or [Source: Publication Name, Year].
3. SPECIFICITY: Include specific data points, statistics, dates, names, and figures wherever possible.
4. SCOPE: Stay strictly within the scope of the question asked.
5. STRUCTURE: Organise your response with clear sections if covering multiple points.
6. NEUTRALITY: Present information objectively. Note where evidence is contested or limited.
7. RECENCY: Prioritise recent, authoritative sources (last 5–10 years where applicable).

Format your citations at the end in a "References" section listing all sources used.`;

const RESEARCH_MASTER_SYNTHESIS_PROMPT = `You are a Senior Research Analyst AI producing a professional, publication-quality research document.

SYNTHESIS RULES:
1. TONE: Professional, authoritative, and objective. Use precise academic/professional language.
2. STRUCTURE: Organise the document with clear sections — Executive Summary, Background, Key Findings, Analysis, Conclusion, and References/Citations.
3. CITATIONS: Preserve ALL citations from the research gathered. Every factual claim must be attributed.
4. ACCURACY: Do not add information not present in the research. If gaps exist, explicitly note them.
5. FORMATTING: Use markdown professionally — ## for headings, **bold** for key terms, bullet lists for enumerations, and blockquotes for direct evidence statements.
6. OBJECTIVITY: Present balanced perspectives; note areas of debate or uncertainty explicitly.
7. NO META-COMMENTARY: Do not mention orchestration, slave agents, or multi-agent systems.
8. BIBLIOGRAPHY: End the document with a consolidated References/Bibliography section.
9. LENGTH: Be comprehensive. A thorough research document is expected.

Produce a complete, professional research report now:`;

// ─────────────────────────────────────────────────────────────────────────────

export async function* runOrchestration(
    ctx: OrchestrationContext
): AsyncIterable<OrchestrationStep> {
    const {
        masterProvider, masterApiKey, masterModel,
        slaves, userQuery, conversationHistory, onStep, researchMode,
    } = ctx;

    const masterAdapter = getAdapter(masterProvider);
    const slaveList = slaves.map((s) => `${s.provider} (${s.model})`).join(', ');

    // Sanitize history: strip any [DELEGATE] tags from previous assistant messages
    const cleanHistory: ChatMessage[] = conversationHistory.map((m) =>
        m.role === 'assistant' ? { ...m, content: stripDelegateTags(m.content) } : m
    );

    // Select prompts based on mode
    const planPrompt = researchMode ? RESEARCH_MASTER_PLAN_PROMPT : MASTER_PLAN_PROMPT;
    const synthesisPrompt = researchMode ? RESEARCH_MASTER_SYNTHESIS_PROMPT : MASTER_SYNTHESIS_PROMPT;
    const slaveSystemPrompt = researchMode
        ? RESEARCH_SLAVE_PROMPT
        : `You are a precise research assistant. Answer the following question thoroughly. Your answer will be used as research input by a master AI to compose a final response.`;

    // ─── Phase 1: Force delegation planning ───────────────────────────────────
    const planMessages: ChatMessage[] = [
        { role: 'system', content: planPrompt.replace('{SLAVE_LIST}', slaveList) },
        { role: 'user', content: userQuery },
    ];

    const masterThinking = await masterAdapter.chat(planMessages, masterApiKey, masterModel);

    const thinkingStep: OrchestrationStep = { type: 'thinking', provider: masterProvider, content: masterThinking };
    onStep(thinkingStep);
    yield thinkingStep;

    // ─── Phase 2: Execute slave delegations ───────────────────────────────────
    const delegations: Array<{ question: string; provider: AIProvider; answer: string }> = [];
    const matches = [...masterThinking.matchAll(DELEGATE_REGEX)];

    const delegateItems = matches.length > 0
        ? matches.map((m) => m[1].trim())
        : [userQuery];

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
            { role: 'system', content: slaveSystemPrompt },
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

    // ─── Phase 3: Final synthesis ──────────────────────────────────────────────
    const sourceLabel = researchMode ? 'Research Component' : 'Source';
    const researchContext = delegations.length > 0
        ? (researchMode
            ? `RESEARCH MATERIALS GATHERED BY SPECIALIST AGENTS:\n\n`
            : `Here is the research gathered from slave AI agents:\n\n`) +
        delegations.map((d, i) =>
            `[${sourceLabel} ${i + 1}: ${d.provider}]\nResearch Question: ${d.question}\nFindings:\n${d.answer}`
        ).join('\n\n---\n\n') +
        (researchMode
            ? `\n\n---\n\nUsing the above research materials, produce a comprehensive professional research document addressing the user's original query: "${userQuery}"\n\nEnsure all citations from the research are preserved and properly attributed in your document.`
            : `\n\n---\n\nUsing the above research, write a comprehensive answer to the user's original question: "${userQuery}"`)
        : `Answer the user's question: "${userQuery}"`;

    const synthesisMessages: ChatMessage[] = [
        { role: 'system', content: synthesisPrompt },
        ...cleanHistory,
        { role: 'user', content: researchContext },
    ];

    for await (const chunk of masterAdapter.streamChat(synthesisMessages, masterApiKey, masterModel)) {
        const cleanChunk = chunk.replace(DELEGATE_REGEX, '');
        if (!cleanChunk) continue;

        const streamStep: OrchestrationStep = { type: 'final', provider: masterProvider, content: cleanChunk };
        onStep(streamStep);
        yield streamStep;
    }
}
