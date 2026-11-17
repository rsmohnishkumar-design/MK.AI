# Nova AI — research roadmap (what is real, what is research)

Nova AI is an Artificial Narrow Intelligence (ANI) system: a set of tools and
specialist agents around language models. It is not conscious, self-aware or
generally intelligent, and must never claim to be.

## Where each AI category stands in Nova AI

| Category | In Nova AI today | Next measurable step |
| --- | --- | --- |
| Analytical (discriminative) | Working: statistics, outliers, correlation, group comparison (`js/agent/analytics.js`) | Add classification of tabular data with a held-out accuracy test |
| Predictive | Working: Holt forecasting with ranges and stated assumptions | Back-test: forecast the last 20% of real series, report error |
| Prescriptive | Working: weighted decisions, constraints, sensitivity | Add simple optimisation (budget / timetable) with checks |
| Generative | Working: text, code, documents, images (real models); video: not available | Video only when a dependable model is affordable (see below) |
| Assistive (copilot) | Working: chat, Code Studio, documents, avatar | Measure task success on eval sets |
| Agentic | Working: plan → tools → verify, task states, approvals, resume (`js/agent/engine.js`) | Tool-use eval: right tool, right result, no unapproved actions |
| Multi-agent | Working: 9 specialist agents, capped help requests | Measure if multi-agent beats single-agent on the same tasks |
| Embodied (physical) | Robot link exists (`js/robot.js`) but only mirrors the avatar; no autonomous actions | Simulation first: a virtual robot that receives the same messages, with a safety layer before any real motor command |
| Reactive machines | Working: tasks with memory off use only the current input | — |
| Limited memory | Working: user-approved memory notes, per device, viewable and deletable | Measure whether memory improves answers without leaking |
| Theory of Mind | Research only | Experiments: false-belief stories (Sally-Anne style) in English and Tamil, scored automatically; report results, make no claims |
| Self-awareness | Not present. The engine monitors its own steps (verification), which is self-monitoring, not awareness | Metacognition experiment: does the model's stated confidence match its accuracy? (calibration curves) |
| AGI | Not present | Track generalisation: performance on new task types without changes |
| ASI | Not present | Out of scope beyond reading and safety research |

## Video generation: honest path

There is no dependable free text-to-video model to call today. Options, all needing owner approval:
1. A paid video API used rarely (cost per clip; would exceed ₹0).
2. A self-hosted open video model (needs a large GPU; not free).
3. Keep today's honest feature: short animations built from real AI photos, labelled as animations.

## Embodied AI: safety rules before any real device action

- Simulation first; real devices only after the same commands pass in simulation.
- Every motor command goes through limits (speed, angle, time) and an emergency stop.
- The person must connect the device themselves and approve each new capability.
- No physical action is ever triggered by text from the web or files.

## NOVA LLM

See `nova-llm/README.md`.
