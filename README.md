Yes. If you want **one complete README that you can paste in one shot**, let's do that instead of playing README Jenga. 😭

I checked the actual repository and `package.json` first, so I'm not inventing dependencies or commands. The repo currently contains the `app`, `components`, `data/california`, `lib`, and `tests` structure, and the package scripts include `dev`, `build`, `start`, `lint`, `typecheck`, and `test`. ([GitHub][1])

I also checked the current official California sources so the legal-scope section doesn't accidentally claim something the source doesn't support. ([California DOJ AG Office][2])

### Replace the entire README with this

````markdown
# RightsPath

**Know what comes next.**

RightsPath is an AI-powered tenant-rights intake and action tool for California renters.

It helps a renter turn a housing problem described in plain language into structured facts, identify missing information, understand relevant California legal information from verified sources, receive practical next steps, and generate a personalized action letter that can be downloaded as a PDF.

> **Human first. Legal second. AI third.**

---

## The Problem

Housing problems can become difficult to navigate very quickly.

A renter dealing with a security-deposit dispute, neglected repairs, or an eviction notice may not know:

- What information matters
- What facts are still missing
- Which rules may apply
- What their next practical step should be
- How to communicate their position clearly to a landlord

Legal information is often difficult to navigate, while legal-aid organizations can have limited capacity.

RightsPath is designed to make the first step clearer.

---

## The Solution

RightsPath combines structured case intake, verified legal rules, deterministic checks, and AI-assisted language interpretation into one guided workflow.

Instead of acting like a generic legal chatbot, RightsPath is designed around a concrete outcome:

**Understand the situation → identify what is missing → understand the relevant information → decide what to do next → create something usable.**

The final output can be a personalized action letter that the renter can review, edit, and download as a PDF.

---

## Current Scope

RightsPath currently focuses on **California residential tenancy** situations.

The prototype supports three issue categories:

### 1. Security Deposit Disputes

The system collects relevant information such as:

- Move-out date
- Deposit amount
- Amount returned
- Deductions
- Whether an itemized statement was received
- Other facts needed to evaluate the situation

### 2. Repair Neglect

The system collects information such as:

- Description of the repair problem
- When the problem was reported
- How it was reported
- Landlord response
- Potential safety concerns

### 3. Eviction Notices

The system collects information such as:

- Notice type
- Date received
- Deadline stated on the notice
- Reason given for the notice

Eviction-related cases are handled conservatively because incorrect guidance can have serious consequences.

---

## How It Works

The core workflow is:

```text
User story
    ↓
Structured facts
    ↓
Missing-fact detection
    ↓
Verified legal rules
    ↓
Deterministic checks
    ↓
Plain-language explanation
    ↓
Action plan
    ↓
Personalized letter
    ↓
PDF
````

### Step 1: Tell RightsPath What Happened

The renter describes their situation naturally instead of needing to understand legal terminology first.

### Step 2: Structure the Story

RightsPath organizes the description into relevant case facts.

The system distinguishes between information the user actually provided and information that has not been established.

### Step 3: Identify Missing Information

RightsPath does not fill gaps by guessing.

If an important fact is missing, the system explains what is missing and why that information matters.

### Step 4: Check Verified Rules

The structured case is evaluated against the application's verified California legal-rule data.

The AI model is not treated as the legal authority.

### Step 5: Explain the Situation

Relevant information is presented in plain language rather than requiring the user to interpret legal terminology or raw statutes.

### Step 6: Provide an Action Plan

The user receives practical next steps based on the available information.

### Step 7: Generate a Letter

RightsPath creates a personalized action letter using the facts established during the case.

### Step 8: Export a PDF

The completed letter can be generated as a downloadable PDF.

---

## Core Design Principle

### Human first. Legal second. AI third.

RightsPath is intentionally designed so that the language model is not the source of truth.

AI is used primarily to:

* Interpret natural-language descriptions
* Organize user-provided information
* Help explain information clearly
* Assist with generating user-facing language

Verified legal rules provide the authority used by the application.

Deterministic logic handles structured calculations and checks where appropriate.

This separation is intended to reduce the risk of an AI model confidently inventing legal rules.

---

## Safety and Trust

RightsPath is designed as a legal-information and action-planning tool, not a replacement for a lawyer.

The system can recognize when important information is missing and avoid presenting an unsupported conclusion.

The application uses explicit case states such as:

* `READY`
* `NEEDS_INFORMATION`
* `ESCALATE`

These states allow the system to distinguish between a case with sufficient structured information and one where additional information or human/legal assistance may be appropriate.

### No invented facts

RightsPath is designed around a simple rule:

**If the user did not establish a fact, the system should not pretend that the fact is known.**

### Conservative handling

The application is especially cautious with eviction-related situations.

RightsPath does not automatically tell a user that an eviction is illegal, instruct them to ignore a notice, or make other high-consequence recommendations without sufficient support.

When the available information is insufficient, the useful result may be identifying what still needs to be established.

---

## Legal Information Sources

The current legal-information scope is based on official California sources, including:

* California Department of Justice / Office of the Attorney General
* California Courts Self-Help Guide

For example, the California Attorney General explains that residential security deposits generally have specific permitted uses and that, subject to applicable exceptions, landlords generally must return the deposit or provide an itemized statement within 21 days after move-out.

California Courts provides official guidance on eviction notice types and explains that different notices can have different requirements and timelines.

RightsPath does not attempt to cover every California housing law, local ordinance, or possible tenancy situation.

The current prototype is intentionally limited in scope.

---

## Architecture

The application separates natural-language interpretation from legal rules and deterministic logic.

```text
                    ┌───────────────────┐
                    │   User Story      │
                    └─────────┬─────────┘
                              ↓
                    ┌───────────────────┐
                    │ Structured Facts  │
                    └─────────┬─────────┘
                              ↓
                    ┌───────────────────┐
                    │ Missing Facts     │
                    │ Detection         │
                    └─────────┬─────────┘
                              ↓
                    ┌───────────────────┐
                    │ Verified Legal    │
                    │ Rules             │
                    └─────────┬─────────┘
                              ↓
                    ┌───────────────────┐
                    │ Deterministic     │
                    │ Checks            │
                    └─────────┬─────────┘
                              ↓
                    ┌───────────────────┐
                    │ Explanation       │
                    └─────────┬─────────┘
                              ↓
                    ┌───────────────────┐
                    │ Action Plan       │
                    └─────────┬─────────┘
                              ↓
                    ┌───────────────────┐
                    │ Action Letter     │
                    └─────────┬─────────┘
                              ↓
                    ┌───────────────────┐
                    │ PDF Export        │
                    └───────────────────┘
```

---

## Project Structure

```text
rightspath/
├── app/
│   ├── API routes
│   ├── application pages
│   └── case workflow
│
├── components/
│   ├── UI components
│   ├── intake components
│   ├── analysis components
│   ├── case review
│   ├── rights explanation
│   ├── action plan
│   └── letter generation
│
├── data/
│   └── california/
│       └── verified legal-rule data
│
├── lib/
│   ├── AI integration
│   ├── rule evaluation
│   ├── calculations
│   ├── validation
│   └── PDF generation
│
├── tests/
│   ├── intake tests
│   ├── analysis tests
│   ├── review tests
│   ├── rule tests
│   ├── adversarial tests
│   ├── explanation tests
│   ├── action-plan tests
│   └── letter tests
│
├── public/
├── package.json
└── README.md
```

---

## Technology

### Application

* Next.js
* React
* TypeScript
* Tailwind CSS

### UI

* Framer Motion
* Lucide React
* Responsive, mobile-first interface
* Accessibility-focused interaction patterns

### AI and Validation

* OpenAI API
* Zod
* Structured application data
* Deterministic rule and date calculations

### Document Generation

* pdf-lib

### Development

* Node.js
* ESLint
* TypeScript
* Automated Node test runner

The project's current `package.json` defines the development, production build, linting, type-checking, and test commands used by the project.

---

## Data and Privacy Design

RightsPath is intentionally lightweight for the prototype.

The application does not require user accounts for the core workflow.

Draft case information can be maintained locally during the session rather than requiring a full account system.

The prototype is designed around collecting only the information necessary for the supported workflow.

Users should avoid entering unnecessary sensitive personal information.

---

## Validation and Testing

Testing is treated as part of the product rather than as an afterthought.

The project includes tests for:

* Intake behavior
* Case analysis
* Structured fact extraction
* Missing-fact detection
* Review behavior
* Rule evaluation
* Date calculations
* Security-deposit rules
* Adversarial cases
* Verified-rule integrity
* Explanations
* User experience states
* Action plans
* Letter generation
* Derived calculations
* Case evaluation
* Rule-engine behavior

### Run tests

```bash
npm test
```

### Type-check

```bash
npm run typecheck
```

### Lint

```bash
npm run lint
```

### Production build

```bash
npm run build
```

### Development server

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

---

## Design Philosophy

RightsPath is deliberately designed to feel more like a trustworthy public-facing civic tool than a generic AI chatbot.

The interface prioritizes:

* Clear hierarchy
* Plain language
* Visible progress
* Strong readability
* Accessible interactions
* Calm visual design
* Explicit uncertainty
* Source transparency
* Actionable outputs

The product avoids relying on visual effects to communicate trust.

The guiding idea is:

> **The user should understand what RightsPath knows, what it does not know, and what they can do next.**

---

## Accessibility

The interface is designed with accessibility in mind, including:

* Semantic HTML
* Visible focus states
* Keyboard navigation
* Accessible labels
* ARIA support where appropriate
* Reduced-motion considerations
* Sufficient color contrast
* Meaning that is not communicated through color alone
* Responsive layouts
* Mobile-friendly interaction targets

---

## Limitations

RightsPath is a prototype with intentionally limited scope.

It currently:

* Focuses on California
* Covers three primary issue categories
* Does not replace legal counsel
* Does not guarantee that a user's situation has been legally resolved
* Does not cover every local housing ordinance
* Does not cover every possible tenancy arrangement
* May require additional information before producing useful guidance
* Should not be treated as a definitive legal opinion

California housing law can depend on facts, local rules, property type, tenancy status, notice details, and other circumstances.

For situations with serious consequences or uncertainty, users should seek qualified legal or legal-aid assistance.

---

## AI Disclosure

AI coding tools, including Cursor, ChatGPT, and other AI-assisted development tools, were used during development.

AI assistance was used for development, debugging, iteration, research support, and implementation assistance.

The project creator reviewed and tested the implementation and is responsible for understanding the submitted project.

Within the application itself, AI is used as an interpretation and language-generation layer. Verified legal-rule data and deterministic application logic are intentionally kept separate from the model's generated language.

---

## Hackathon Context

RightsPath was built for **LexHack 2026** as an entry in the legal-tech / access-to-justice space.

The project focuses on making the first step after a housing problem more understandable and actionable for renters.

The prototype prioritizes:

* Real-world usefulness
* Feasible implementation
* Technical reliability
* Clear user experience
* Responsible AI use
* Source-grounded legal information
* A concrete user-facing output

---

## Project Status

**Prototype: End-to-end workflow implemented.**

The current workflow covers:

```text
Landing
  ↓
Jurisdiction
  ↓
Issue selection
  ↓
Tenant story
  ↓
Case analysis
  ↓
Case review
  ↓
Rights / source information
  ↓
Action plan
  ↓
Personalized letter
  ↓
PDF export
```

---

## Future Directions

Potential future development could include:

* Additional California housing issues
* More comprehensive local-jurisdiction coverage
* Additional verified legal sources
* Expanded legal-aid referrals
* Better document and notice analysis
* More robust case-history management
* Broader jurisdiction support
* Professional review of expanded legal-rule coverage

These are future possibilities rather than claims about the current prototype.

---

## Disclaimer

RightsPath provides general legal information and practical guidance.

It is not a law firm, does not provide legal representation, and does not establish an attorney-client relationship.

The information generated by RightsPath should not be treated as a definitive legal opinion.

Users should consult a qualified attorney, legal-aid organization, or appropriate housing resource for advice about their specific circumstances.

---

## License

No open-source license has been added to this repository at this time.

---

## Credits

**Project:** RightsPath

**Purpose:** AI-powered tenant-rights intake and action-letter generation

**Current jurisdiction:** California, United States

**Development:** Independent hackathon project

**AI development assistance:** Cursor, ChatGPT, and other AI-assisted development tools

---

## Acknowledgements

RightsPath builds on publicly available legal information and self-help resources published by California government institutions.

Relevant sources include:

* California Department of Justice / Office of the Attorney General
* California Courts Self-Help Guide

All legal information should be checked against the current official sources before being relied upon for a real-world situation.


[1]: https://github.com/levilabs-hash/rightspath/blob/master/package.json "rightspath/package.json at master · levilabs-hash/rightspath · GitHub"
[2]: https://oag.ca.gov/tenants?utm_source=chatgpt.com "Landlord-Tenant Issues | State of California - Department of Justice - Office of the Attorney General"
