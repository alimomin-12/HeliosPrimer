import { getAdapter, type AIProvider } from './registry';
import type { ChatMessage, ChatContentPart } from './types';

// DELEGATE_REGEX and stripDelegateTags removed as we now use structured JSON

/**
 * Extracts plain text from a message's content (string or parts).
 */
function getTextContent(content: string | ChatContentPart[]): string {
    if (typeof content === 'string') return content;
    return content
        .filter((part) => part.type === 'text')
        .map((part) => (part as any).text)
        .join('\n');
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
    userQuery: string | ChatContentPart[];
    conversationHistory: ChatMessage[];
    onStep: (step: OrchestrationStep) => void;
    researchMode?: boolean;
}

// ── STANDARD PROMPTS ──────────────────────────────────────────────────────────

const MASTER_PLAN_PROMPT = `You are the Master AI Orchestrator. You MUST coordinate with slave AI agents by delegating sub-tasks to them. This is required.

YOUR ONLY JOB IN THIS STEP is to issue delegation calls to your slave AIs by outputting a valid JSON array of sub-tasks.

MANDATORY RULES:
1. You MUST break down the user's question into focused sub-tasks and delegate each one.
2. You must return ONLY a JSON array, where each object represents a delegation task. Do NOT wrap the JSON in markdown code blocks or add any conversational text.
3. Each task object MUST have this exact structure:
{
  "taskId": "a unique identifier for this task (e.g., task-1)",
  "taskDescription": "detailed instructions for the slave AI to perform",
  "expectedOutputFormat": "description of the exact JSON structure the slave should return"
}
4. You WILL write the complete final answer in the next step after receiving slave responses.

Available slave AIs: {SLAVE_LIST}

Example of correct output:
[
  {
    "taskId": "task-1",
    "taskDescription": "What are the main advantages of X?",
    "expectedOutputFormat": "{ \"advantages\": [\"adv1\", \"adv2\"] }"
  },
  {
    "taskId": "task-2",
    "taskDescription": "What are the main disadvantages of X?",
    "expectedOutputFormat": "{ \"disadvantages\": [\"dis1\", \"dis2\"] }"
  }
]

Now, output the JSON array of delegation tasks for the user's question:`;

const MASTER_SYNTHESIS_PROMPT = `You are an expert AI assistant providing a comprehensive final answer.

RULES:
- Answer the user's question directly and thoroughly based on the structured JSON responses provided by the slave AIs.
- Do NOT mention orchestration, slaves, or multi-agent systems in your answer.
- Incorporate any research provided to you naturally, as if you researched it yourself.
- Be well-structured, clear, and helpful.`;

// ── RESEARCH MODE PROMPTS ─────────────────────────────────────────────────────

const RESEARCH_MASTER_PLAN_PROMPT = `You are the Master Research Coordinator AI. Your role is to design a rigorous, multi-angle research plan and delegate each research angle to specialist slave AI agents.

YOUR ONLY JOB IN THIS STEP is to create a structured research agenda and issue precise delegation tasks by outputting a valid JSON array.

RESEARCH PLANNING RULES:
1. Decompose the user's topic into 3–6 distinct, non-overlapping research sub-tasks.
2. Each delegation must ask for FACTS, DATA, STATISTICS, and CITATIONS — not opinions.
3. You must return ONLY a JSON array. Do NOT wrap the JSON in markdown code blocks or add any conversational text.
4. Each task object MUST have this exact structure:
{
  "taskId": "a unique identifier (e.g., historical-analysis)",
  "taskDescription": "specific factual research question with sourcing requirements",
  "expectedOutputFormat": "description of the exact JSON structure the slave should return, e.g., { \"findings\": [\"fact 1\"], \"sources\": [\"source 1\"] }"
}
5. After all delegations are processed, you will synthesize a professional research structured document in the next step.

Available specialist agents: {SLAVE_LIST}

Example research delegation format:
[
  {
    "taskId": "peer-review-search",
    "taskDescription": "What does peer-reviewed research say about X? Include specific study names, authors, publication years, and statistical findings.",
    "expectedOutputFormat": "{ \"studies\": [ { \"title\": \"...\", \"findings\": \"...\", \"authors\": \"...\", \"year\": 2023 } ] }"
  }
]

Now create your research plan and output the JSON array of delegation tasks for the topic:`;

const RESEARCH_SLAVE_PROMPT = `You are a specialist Research Agent. Your role is to provide highly accurate, factual, citation-backed responses.

CRITICAL REQUIREMENTS:
1. ACCURACY: Only state facts you can confirm. Do not speculate or extrapolate.
2. CITATIONS: For every claim, provide the source.
3. STRUCTURE: You MUST return your response ONLY as a valid JSON object matching the "expectedOutputFormat" requested by the Master AI. Do NOT include any conversational text, markdown formatting (like \`\`\`json), or explanations outside the JSON object.
4. NEUTRALITY: Present information objectively. Note where evidence is contested or limited.
5. RECENCY: Prioritise recent, authoritative sources (last 5–10 years where applicable).`;

const RESEARCH_MASTER_SYNTHESIS_PROMPT = `You are a Senior Research Analyst AI producing a professional, publication-quality research document based on structured JSON findings.

SYNTHESIS RULES:
1. TONE: Professional, authoritative, and objective. Use precise academic/professional language.
2. STRUCTURE: Organise the document with clear sections — Executive Summary, Background, Key Findings, Analysis, Conclusion, and References/Citations.
3. CITATIONS: Preserve ALL citations from the JSON research gathered. Every factual claim must be attributed.
4. ACCURACY: Do not add information not present in the research. If gaps exist, explicitly note them.
5. FORMATTING: Use markdown professionally — ## for headings, **bold** for key terms, bullet lists for enumerations, and blockquotes for direct evidence statements.
6. OBJECTIVITY: Present balanced perspectives; note areas of debate or uncertainty explicitly.
7. NO META-COMMENTARY: Do not mention orchestration, slave agents, or multi-agent systems.
8. BIBLIOGRAPHY: End the document with a consolidated References/Bibliography section.
9. LENGTH: Be comprehensive. A thorough research document is expected.
10. OUTPUT FORMAT: If the user requested a specific format (e.g., Markdown, JSON), you MUST wrap your ENTIRE final response inside a markdown code block of that format (e.g., \`\`\`markdown ... \`\`\` or \`\`\`json ... \`\`\`) so it can be extracted as an artifact file. If no specific format was requested, wrap your response in a \`\`\`markdown code block anyway.

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

    // History is used as is since DELEGATE tags are no longer used
    const cleanHistory: ChatMessage[] = conversationHistory;

    // Select prompts based on mode
    const planPrompt = researchMode ? RESEARCH_MASTER_PLAN_PROMPT : MASTER_PLAN_PROMPT;
    const synthesisPrompt = researchMode ? RESEARCH_MASTER_SYNTHESIS_PROMPT : MASTER_SYNTHESIS_PROMPT;
    const slaveSystemPrompt = researchMode
        ? RESEARCH_SLAVE_PROMPT
        : `You are a precise research assistant. Answer the following question thoroughly. You MUST return your response ONLY as a valid JSON object matching the "expectedOutputFormat" requested. Do NOT include any conversational text, markdown formatting (like \`\`\`json), or explanations outside the JSON object.`;

    if (researchMode) {
        // Step 0: Check if format is specified
        const recentHistory = cleanHistory.slice(-4).map(m => m.content).join('\n');
        const formatCheckStr = await masterAdapter.chat([
            { role: 'system', content: `Analyze the conversation. Has the user specified a desired output file format (e.g., Markdown, JSON, HTML, CSV, TXT, Report format)? Reply ONLY with exactly "YES" or "NO".` },
            { role: 'user', content: `Context:\n${recentHistory}\n\nCurrent User Query:\n${getTextContent(userQuery)}` }
        ], masterApiKey, masterModel);

        if (formatCheckStr.includes('NO')) {
            yield {
                type: 'final',
                provider: masterProvider,
                content: "Before I proceed with the complex research, could you please specify your desired output file format for the final result? (e.g., Markdown file, JSON structure, or plain text?)"
            };
            return;
        }
    }

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

    let tasks: Array<{ taskId: string, taskDescription: string, expectedOutputFormat: string }> = [];
    try {
        // Attempt to extract JSON if wrapped in markdown
        const jsonMatch = masterThinking.match(/\[[\s\S]*\]/);
        const jsonStr = jsonMatch ? jsonMatch[0] : masterThinking;
        tasks = JSON.parse(jsonStr);
        if (!Array.isArray(tasks)) {
            throw new Error("Parsed result is not an array");
        }
    } catch (e) {
        console.warn("Failed to parse JSON tasks from master, falling back", e);
        tasks = [{
            taskId: "fallback-task",
            taskDescription: getTextContent(userQuery),
            expectedOutputFormat: "{ \"answer\": \"detailed answer string\" }"
        }];
    }

    const maxSlavesToUse = Math.min(tasks.length, slaves.length);
    const validSlaves = slaves.length > 0 ? slaves : [];

    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const slave = validSlaves.length > 0 ? validSlaves[i % validSlaves.length] : undefined;

        if (!slave) break; // Should not happen ideally if runOrchestration is called correctly

        const delegationStep: OrchestrationStep = {
            type: 'delegation', provider: masterProvider,
            delegateTo: slave.provider, question: task.taskDescription, content: JSON.stringify(task, null, 2),
        };
        onStep(delegationStep);
        yield delegationStep;

        const slaveAdapter = getAdapter(slave.provider);
        const slaveMessages: ChatMessage[] = [
            { role: 'system', content: slaveSystemPrompt },
            { role: 'user', content: `Task Description: ${task.taskDescription}\n\nExpected Output Format: ${task.expectedOutputFormat}\n\nRemember to ONLY output valid JSON matching the expected format.` },
        ];

        let slaveRawAnswer = await slaveAdapter.chat(slaveMessages, slave.apiKey, slave.model);

        let slaveAnswer = slaveRawAnswer;
        try {
            const jsonObjMatch = slaveRawAnswer.match(/\{[\s\S]*\}/);
            if (jsonObjMatch) {
                slaveAnswer = jsonObjMatch[0];
                // Verify it's actually valid JSON, but we just pass the string forward anyway
                JSON.parse(slaveAnswer);
            }
        } catch {
            // Keep original answer if parsing fix fails
        }

        const slaveStep: OrchestrationStep = {
            type: 'slave_response', provider: slave.provider, content: slaveAnswer, question: task.taskDescription,
        };
        onStep(slaveStep);
        yield slaveStep;

        delegations.push({ question: task.taskDescription, provider: slave.provider, answer: slaveAnswer });
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
            ? `\n\n---\n\nUsing the above research materials, produce a comprehensive professional research document addressing the user's original query: "${getTextContent(userQuery)}"\n\nEnsure all citations from the research are preserved and properly attributed in your document.`
            : `\n\n---\n\nUsing the above research, write a comprehensive answer to the user's original question: "${getTextContent(userQuery)}"`)
        : `Answer the user's question: "${getTextContent(userQuery)}"`;

    const synthesisMessages: ChatMessage[] = [
        { role: 'system', content: synthesisPrompt },
        ...cleanHistory,
        { role: 'user', content: researchContext },
    ];

    for await (const chunk of masterAdapter.streamChat(synthesisMessages, masterApiKey, masterModel)) {
        if (!chunk) continue;

        const streamStep: OrchestrationStep = { type: 'final', provider: masterProvider, content: chunk };
        onStep(streamStep);
        yield streamStep;
    }
}
