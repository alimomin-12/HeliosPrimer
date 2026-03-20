export interface OrchestratorVersion {
  version: string;
  name: string; // The combo name like "Orion Striker"
  date: string;
  summary: string;
  features: string[];
}

export const ORCHESTRATOR_VERSIONS: OrchestratorVersion[] = [
  {
    version: "1.0.0",
    name: "Orion Striker",
    date: "2026-01-01",
    summary: "Initial text-based orchestrator utilizing regex parsing.",
    features: ["Textual token delegation via [DELEGATE:]", "String replacements", "Synchronous master generation"]
  },
  {
    version: "2.0.0",
    name: "Horizon Bright",
    date: "2026-03-20",
    summary: "Transformed orchestration to robust structured JSON objects.",
    features: ["JSON array task delegation", "Structured JSON slave adherence", "Fault-tolerant parsing fallbacks"]
  }
];

export const CURRENT_ORCHESTRATOR_VERSION = ORCHESTRATOR_VERSIONS[ORCHESTRATOR_VERSIONS.length - 1];
