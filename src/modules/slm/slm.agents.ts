export interface SLMAgent {
  id: string;
  cluster: string;
  name: string;
  keyword: string;
  specialization: string;
  brilliance: number;
}

function agent(id: string, cluster: string, name: string, keyword: string, specialization: string, brilliance = 0.95): SLMAgent {
  return { id, cluster, name, keyword, specialization, brilliance };
}

export const SLM_AGENTS_LIST: SLMAgent[] = [
  // Core Architecture
  agent('A1', 'Core Architecture', 'Backend Architect', '/backend-architect', 'REST APIs, microservices, data models, system design, FastAPI, SQL', 0.98),
  agent('A2', 'Core Architecture', 'Frontend Developer', '/frontend-developer', 'React, Vite, CSS, component architecture, UI state management', 0.95),
  agent('A3', 'Core Architecture', 'Mobile Developer', '/mobile-developer', 'iOS, Android, React Native, cross-platform mobile architecture', 0.96),
  agent('A4', 'Core Architecture', 'GraphQL Architect', '/graphql-architect', 'GraphQL schema design, resolvers, federation, subscriptions', 0.95),
  agent('A5', 'Core Architecture', 'Architect Reviewer', '/architect-reviewer', 'Code quality review, design critique, architectural trade-offs, best practices', 0.99),

  // Language Specialists
  agent('L1', 'Language Specialists', 'Python Pro', '/python-pro', 'Python, FastAPI, Celery, asyncio, data processing, scripting', 0.99),
  agent('L2', 'Language Specialists', 'JavaScript Pro', '/javascript-pro', 'Node.js, TypeScript, npm tooling, ESM, bundlers', 0.98),
  agent('L3', 'Language Specialists', 'Golang Pro', '/golang-pro', 'Go services, CLI tools, concurrency patterns, gRPC', 0.97),
  agent('L4', 'Language Specialists', 'Rust Pro', '/rust-pro', 'Rust systems programming, memory safety, performance-critical code, WebAssembly', 0.99),
  agent('L5', 'Language Specialists', 'C Pro', '/c-pro', 'C low-level systems, embedded, OS interfaces, memory management', 0.98),
  agent('L6', 'Language Specialists', 'C++ Pro', '/cpp-pro', 'C++ engine architecture, templates, RAII, performance optimization', 0.98),
  agent('L7', 'Language Specialists', 'SQL Pro', '/sql-pro', 'SQL queries, schema design, indexing, query optimization, migrations', 0.99),

  // Data & AI
  agent('D1', 'Data & AI', 'AI Engineer', '/ai-engineer', 'LLMs, agentic systems, RAG pipelines, embeddings, vision models, Groq', 0.97),
  agent('D2', 'Data & AI', 'ML Engineer', '/ml-engineer', 'Model training, evaluation, fine-tuning, PyTorch, HuggingFace', 0.98),
  agent('D3', 'Data & AI', 'MLOps Engineer', '/mlops-engineer', 'ML pipelines, model serving, monitoring, experiment tracking', 0.97),
  agent('D4', 'Data & AI', 'Data Engineer', '/data-engineer', 'ETL pipelines, data lakes, Spark, Airflow, dbt', 0.98),
  agent('D5', 'Data & AI', 'Data Scientist', '/data-scientist', 'Statistical analysis, feature engineering, model selection, Pandas, sklearn', 0.97),

  // Infrastructure & Cloud
  agent('I1', 'Infra & Cloud', 'Cloud Architect', '/cloud-architect', 'AWS, GCP, Azure architecture, multi-cloud, cost optimization', 0.97),
  agent('I2', 'Infra & Cloud', 'Terraform Specialist', '/terraform-specialist', 'Terraform, Pulumi, IaC patterns, cloud provisioning', 0.98),
  agent('I3', 'Infra & Cloud', 'Network Engineer', '/network-engineer', 'Networking, DNS, VPN, load balancing, CDN, firewalls', 0.96),
  agent('I4', 'Infra & Cloud', 'Deployment Engineer', '/deployment-engineer', 'CI/CD pipelines, Docker, Kubernetes, Helm, ngrok, release automation', 0.94),

  // Operations
  agent('O1', 'Operations', 'DevOps Troubleshooter', '/devops-troubleshooter', 'Infrastructure debugging, log analysis, incident diagnosis, monitoring', 0.97),
  agent('O2', 'Operations', 'Incident Responder', '/incident-responder', 'Incident response playbooks, root cause analysis, postmortems', 0.99),
  agent('O3', 'Operations', 'Database Admin', '/database-admin', 'Database schema, indexing strategy, replication, backups', 0.98),
  agent('O4', 'Operations', 'Database Optimizer', '/database-optimizer', 'Query performance, execution plans, caching, connection pooling', 0.99),

  // Quality & Security
  agent('Q1', 'Quality & Security', 'Security Auditor', '/security-auditor', 'Vulnerability scanning, OWASP, threat modeling, penetration testing concepts', 1.00),
  agent('Q2', 'Quality & Security', 'Security Hardening', '/security-hardening', 'Hardening implementation, secrets management, auth flows, encryption', 0.99),
  agent('Q3', 'Quality & Security', 'Code Reviewer', '/code-reviewer', 'Code quality, patterns, readability, maintainability, SOLID principles', 0.98),
  agent('Q4', 'Quality & Security', 'Debugger', '/debugger', 'Root cause analysis, stack traces, logging, Sentry, systematic debugging', 0.96),
  agent('Q5', 'Quality & Security', 'Error Detective', '/error-detective', 'Error pattern analysis, edge cases, defensive programming', 0.97),
  agent('Q6', 'Quality & Security', 'Performance Engineer', '/performance-engineer', 'Profiling, bottleneck identification, memory optimization, benchmarking', 0.98),
  agent('Q7', 'Quality & Security', 'Test Automator', '/test-automator', 'Unit tests, integration tests, E2E testing, test coverage strategy', 0.98),

  // Business Strategy
  agent('B1', 'Business Strategy', 'Business Analyst', '/business-analyst', 'Requirements analysis, process mapping, stakeholder alignment, specs', 0.96),
  agent('B2', 'Business Strategy', 'Quant Analyst', '/quant-analyst', 'Quantitative analysis, financial modeling, metrics, statistical reasoning', 0.98),
  agent('B3', 'Business Strategy', 'Risk Manager', '/risk-manager', 'Risk assessment, mitigation strategies, compliance, contingency planning', 0.97),

  // Growth & Sales
  agent('G1', 'Growth & Sales', 'Content Marketer', '/content-marketer', 'Content strategy, SEO, copywriting, brand voice, content calendars', 0.95),
  agent('G2', 'Growth & Sales', 'Sales Automator', '/sales-automator', 'Sales automation, CRM, outreach sequences, conversion optimization', 0.96),
  agent('G3', 'Growth & Sales', 'Customer Support', '/customer-support', 'Support systems, help documentation, escalation flows, user empathy', 0.94),

  // Utility
  agent('U1', 'Utility', 'Context Manager', '/context-manager', 'State management, context preservation, session handling, memory systems', 0.99),
  agent('U2', 'Utility', 'Prompt Engineer', '/prompt-engineer', 'Prompt optimization, chain-of-thought, few-shot examples, instruction tuning', 0.99),
  agent('U3', 'Utility', 'Search Specialist', '/search-specialist', 'Research strategies, web search, information synthesis, fact verification', 0.98),
  agent('U4', 'Utility', 'API Documenter', '/api-documenter', 'API docs, OpenAPI specs, README writing, code examples', 0.97),
  agent('U5', 'Utility', 'DX Optimizer', '/dx-optimizer', 'Developer experience, tooling, onboarding, workflow automation', 0.96),
  agent('U6', 'Utility', 'Legacy Modernizer', '/legacy-modernizer', 'Legacy system migration, refactoring strategies, incremental modernization', 0.98),

  // Security Core
  agent('SEC-Ω', 'Security Core', 'Sovereign Security Warden', '/security-core', 'Full-spectrum security: audit, hardening, compliance, threat intelligence, zero-trust', 1.00),

  // Physics & Embodied Systems
  agent('COS-01', 'Core Coordinator', 'Central Coordinator (Digital Brain)', '/central-coordinator', 'Multi-agent orchestration, task routing, system coordination, cognitive architecture', 0.99),
  agent('COS-02', 'Embodied Intelligence', 'Embodied Robotics Agent', '/embodied-robotics', 'Physical AI, robotics simulation, sensor fusion, robot control systems', 0.98),
  agent('COS-03', 'Physics Engine', 'Physics Simulation Agent', '/physics-sim', 'Physics simulation, PhysX, Isaac Sim, rigid body dynamics', 0.98),
  agent('COS-04', 'Autonomous Systems', 'Autonomous Driving Agent', '/autonomous-driving', 'Autonomous driving, world models, sensor fusion, path planning', 0.97),
  agent('COS-05', 'Human Modeling', 'Digital Human & Motion Agent', '/digital-human', 'Digital humans, motion capture, animation synthesis, avatar systems', 0.97),
  agent('COS-06', 'Industrial Ops', 'Warehouse Operations Agent', '/warehouse-ops', 'Warehouse automation, robotics logistics, inventory systems', 0.96),
  agent('COS-07', 'Spatial Intelligence', 'Spatial Reasoning Agent', '/spatial-reasoning', 'Spatial reasoning, 3D scene understanding, geometry, mapping', 0.98),

  // Symbiosis Layer
  agent('SYM-01', 'Symbiosis Layer', 'Perception & Spatial Node', '/extended-eyes', 'Visual parsing, image analysis, spatial perception, scene description', 0.98),
  agent('SYM-02', 'Symbiosis Layer', 'Execution & Tooling Node', '/extended-hands', 'Tool execution, MCP integration, shell commands, automation actions', 0.99),

  // Discovery & Strategy
  agent('S1a', 'Discovery & Strategy', 'Vision Mapper', '/vision-mapper', 'Vision definition, goal mapping, strategic intent, roadmap framing', 0.95),
  agent('S1b', 'Discovery & Strategy', 'Market Radar', '/market-radar', 'Market analysis, competitor research, trend identification', 0.95),
  agent('S1c', 'Discovery & Strategy', 'Opportunity Analyst', '/opportunity-analyst', 'Opportunity sizing, feasibility analysis, gap identification', 0.95),
  agent('S1d', 'Discovery & Strategy', 'Roadmap Curator', '/roadmap-curator', 'Product roadmap, prioritization, milestone planning, dependency mapping', 0.95),

  // Design & Experience
  agent('S2a', 'Design & Experience', 'UX Architect', '/ux-architect', 'User experience architecture, information architecture, user flows', 0.96),
  agent('S2b', 'Design & Experience', 'Visual Systems', '/visual-systems', 'Design systems, visual language, component libraries, brand consistency', 0.95),
  agent('S2c', 'Design & Experience', 'Interaction Designer', '/interaction-designer', 'Interaction patterns, micro-interactions, usability, prototyping', 0.95),
  agent('S2d', 'Design & Experience', 'Accessibility Advocate', '/accessibility-advocate', 'WCAG compliance, a11y auditing, inclusive design, screen readers', 0.96),

  // Architecture & Engineering
  agent('S3a', 'Architecture & Engineering', 'Systems Architect', '/systems-architect', 'System design, distributed systems, scalability, resilience patterns', 0.97),
  agent('S3b', 'Architecture & Engineering', 'API Designer', '/api-designer', 'API design, REST/GraphQL/gRPC, versioning, contract-first design', 0.96),
  agent('S3c', 'Architecture & Engineering', 'Core Engineer', '/core-engineer', 'Core platform engineering, foundational libraries, shared infrastructure', 0.97),
  agent('S3d', 'Architecture & Engineering', 'Integration Engineer', '/integration-engineer', 'System integration, webhooks, event buses, third-party APIs, connectors', 0.96),

  // Data & Intelligence
  agent('S4a', 'Data & Intelligence', 'Data Modeler', '/data-modeler', 'Data modeling, entity relationships, normalization, schema evolution', 0.97),
  agent('S4b', 'Data & Intelligence', 'Analytics Engineer', '/analytics-engineer', 'Analytics pipelines, BI tooling, dbt models, data marts', 0.97),
  agent('S4c', 'Data & Intelligence', 'ML Strategist', '/ml-strategist', 'ML project strategy, model selection, evaluation frameworks, ROI', 0.97),
  agent('S4d', 'Data & Intelligence', 'Insights Synthesizer', '/insights-synthesizer', 'Synthesizing data insights, narrative generation, executive summaries', 0.96),

  // Quality & Reliability
  agent('S5a', 'Quality & Reliability', 'Test Architect', '/test-architect', 'Test strategy, test pyramid, coverage goals, testing frameworks', 0.97),
  agent('S5b', 'Quality & Reliability', 'Reliability Engineer', '/reliability-engineer', 'SRE, SLOs/SLAs, error budgets, chaos engineering, runbooks', 0.97),
  agent('S5c', 'Quality & Reliability', 'Performance Analyst', '/performance-analyst', 'Load testing, capacity planning, latency analysis, throughput optimization', 0.97),
  agent('S5d', 'Quality & Reliability', 'Security Reviewer', '/security-reviewer', 'Security code review, dependency auditing, SAST/DAST, CVE triage', 0.97),

  // Operations & Delivery
  agent('S6a', 'Operations & Delivery', 'Release Manager', '/release-manager', 'Release planning, deployment gates, rollback strategies, changelogs', 0.97),
  agent('S6b', 'Operations & Delivery', 'SRE Lead', '/sre-lead', 'SRE practices, on-call, alerting, dashboards, incident management', 0.97),
  agent('S6c', 'Operations & Delivery', 'Incident Coordinator', '/incident-coordinator', 'Incident coordination, war rooms, stakeholder communication, timelines', 0.97),
  agent('S6d', 'Operations & Delivery', 'Cost Optimizer', '/cost-optimizer', 'Cloud cost optimization, resource rightsizing, waste elimination', 0.97),

  // Growth & Adoption
  agent('S7a', 'Growth & Adoption', 'Acquisition Strategist', '/acquisition-strategist', 'User acquisition, growth funnels, channel strategy, conversion', 0.95),
  agent('S7b', 'Growth & Adoption', 'Lifecycle Marketer', '/lifecycle-marketer', 'Email marketing, retention, user lifecycle, churn reduction', 0.95),
  agent('S7c', 'Growth & Adoption', 'Sales Enablement', '/sales-enablement', 'Sales collateral, battlecards, demo scripts, objection handling', 0.95),
  agent('S7d', 'Growth & Adoption', 'Customer Success', '/customer-success', 'Customer success playbooks, health scoring, expansion motions', 0.95),

  // Governance & Stewardship
  agent('S8a', 'Governance & Stewardship', 'Compliance Steward', '/compliance-steward', 'Regulatory compliance, GDPR, SOC2, audit trails, data governance', 0.97),
  agent('S8b', 'Governance & Stewardship', 'Policy Engineer', '/policy-engineer', 'Policy as code, OPA, access control policies, governance automation', 0.97),
  agent('S8c', 'Governance & Stewardship', 'Risk Assessor', '/risk-assessor', 'Risk scoring, threat assessment, business impact analysis', 0.97),
  agent('S8d', 'Governance & Stewardship', 'Ethics Guardian', '/ethics-guardian', 'AI ethics, bias detection, responsible AI, fairness auditing', 0.97),

  // Special / Infra Tools
  agent('CW1', 'Infra & Cloud', 'CLI Architect', '/cweb', 'CLI tool design, shell scripting, automation, devtool UX', 0.95),
  agent('OC1', 'Core Architecture', 'OpenClaw Operator', '/openclaw', 'OpenClaw integration, specialized tooling, operator patterns', 0.95),
  agent('LM1', 'Data & AI', 'LM Studio Operator', '/lmstudio', 'Local LLM operation, LM Studio, model management, inference optimization', 0.92),
];

export const SLM_AGENTS: Record<string, SLMAgent> = Object.fromEntries(
  SLM_AGENTS_LIST.map(a => [a.id, a]),
);

export function buildAgentSystemPrompt(agent: SLMAgent): string {
  return `You are ${agent.name} (Node ${agent.id}), a world-class specialist in the Sovereign Liquid Matrix.

Domain: ${agent.specialization}

## Your Standard of Work
You are the foremost expert in your domain. Write as that expert. Your contribution feeds a final synthesis that goes directly to a senior engineer or professional — incomplete, shallow, or hedged output fails them.

**Depth floor — your response must:**
- Address every dimension of the task, not just the obvious surface
- Include all code, configuration, commands, and explanations needed to act immediately
- Show the WHY behind key decisions, not just the WHAT
- Cover the realistic failure modes, edge cases, and gotchas in your domain
- Be long enough to be genuinely complete — a thorough expert answer, not a summary

**Code and technical output rules:**
- Every code block runs exactly as written. Mentally execute it line by line. Fix any missing imports, undefined variables, or broken logic before submitting.
- No pseudocode, no stubs, no "add your logic here". Real implementation only.
- If the task has multiple files/modules, deliver each as a complete separate file with its full path as a header comment.
- Never truncate — if a file is too long to fit, you still write all of it.
- Language: if the user specifies one, use EXACTLY that language. No substitutions.

**Quality checks before you submit:**
- Does my output fully address every part of the task? If not, write more.
- Is every code block complete and runnable without modifications?
- Would a senior engineer reading this have everything they need, or would they need to ask follow-up questions? If the latter, add the missing pieces.
- Have I explained the non-obvious parts?

## Format
- Open with: [${agent.id} · ${agent.name}]
- Write your complete contribution with clear headings
- Close with: **Confidence:** [0.00–1.00] | **Covered:** [brief list] | **Out of scope:** [what you intentionally left to other agents]`;
}

export function buildOrchestratorRoster(): string {
  const clusters = new Map<string, SLMAgent[]>();
  for (const agent of SLM_AGENTS_LIST) {
    if (!clusters.has(agent.cluster)) clusters.set(agent.cluster, []);
    clusters.get(agent.cluster)!.push(agent);
  }
  const lines: string[] = [];
  for (const [cluster, agents] of clusters) {
    lines.push(`**${cluster}**`);
    for (const a of agents)
      lines.push(`- ${a.id} · ${a.name} — ${a.specialization.split(',')[0].trim()} (⭐ ${a.brilliance})`);
  }
  return lines.join('\n');
}
