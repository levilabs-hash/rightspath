
# RightsPath

## Know what comes next.

RightsPath is an AI-powered tenant-rights intake and action-letter generator for California renters.

It turns a messy housing story into structured facts, identifies missing information, connects the case to verified California legal sources, explains what those sources mean in plain language, produces a practical action plan, and generates a personalized action letter with PDF export.

> **Your story → What we found → What we still need → Verified source → What to do next**

[Live Demo](https://rightspath.vercel.app)

---

## The Problem

Housing problems rarely arrive as neatly structured legal cases.

A renter might know that their landlord kept part of a security deposit, ignored a repair, or served an eviction notice, but not know:

- Which facts matter
- What information is missing
- Which legal rule applies
- Where the rule comes from
- What they should do next
- How to turn their situation into a useful written request

Generic AI chatbots can produce fluent answers, but fluency is not the same thing as reliable legal guidance.

RightsPath focuses on the first practical step: turning a renter's story into a structured, source-grounded path forward.

---

## The Solution

RightsPath is deliberately designed as more than an "AI lawyer" chatbot.

The system separates:

1. **Natural-language interpretation**
2. **Structured case facts**
3. **Missing-information detection**
4. **Verified legal-rule data**
5. **Deterministic rule and date calculations**
6. **Plain-language explanations**
7. **Action planning**
8. **Personalized letter generation**
9. **PDF export**

The goal is not to pretend that an AI model can decide a legal case.

The goal is to make the user's next step clearer.

---

## How It Works

```text
TENANT STORY
     ↓
STRUCTURED FACTS
     ↓
MISSING FACT DETECTION
     ↓
VERIFIED CALIFORNIA RULE
     ↓
DETERMINISTIC CHECK
     ↓
PLAIN-LANGUAGE EXPLANATION
     ↓
ACTION PLAN
     ↓
PERSONALIZED LETTER
     ↓
PDF EXPORT
````

### Human first. Legal second. AI third.

RightsPath is designed around a simple principle:

> **The user should understand what RightsPath knows, what it does not know, and what they can do next.**

AI is used to interpret and generate language.

Verified legal sources provide the legal basis.

Deterministic application logic handles structured rule conditions, calculations, and dates where appropriate.

When required information is missing, RightsPath surfaces the gap instead of manufacturing an answer.

---

## Supported Scope

The current prototype focuses on **California residential tenancy** and three primary issue categories:

### 1. Security Deposit Disputes

RightsPath can structure information such as:

* Move-out date
* Deposit amount
* Amount returned
* Deductions
* Itemized-statement information
* Other facts needed to evaluate the supported deposit workflow

### 2. Repair Neglect

The intake can capture information such as:

* Description of the problem
* When it was reported
* How it was reported
* Landlord response
* Safety concerns

### 3. Eviction Notices

The workflow can capture information such as:

* Notice type
* Notice date
* Deadline
* Stated reason

RightsPath intentionally does **not** attempt to cover every California housing law, local ordinance, property type, tenancy arrangement, or possible legal situation.

A narrow scope makes the prototype easier to validate and safer to reason about.

---

## Safety & Legal Boundaries

RightsPath does not treat an LLM response as legal authority.

The system is designed around three possible states:

* **READY** — enough information exists for the supported workflow
* **NEEDS_INFORMATION** — important facts are missing
* **ESCALATE** — the situation is outside the supported scope or requires additional legal assistance

### Missing information is not a reason to guess.

If an important fact is unknown, RightsPath identifies what is missing and explains why it matters.

The system is designed to avoid unsupported conclusions such as declaring that a landlord acted illegally when the available facts do not establish that conclusion.

For higher-risk or uncertain situations, users are directed toward qualified legal or legal-aid assistance.

RightsPath is an information and action-planning prototype, not a law firm and not a substitute for legal counsel.

---

## Verified Legal Sources

The prototype uses publicly available California government legal information and self-help resources.

Primary sources include:

* California Department of Justice / Office of the Attorney General
* California Courts Self-Help Guide

Examples include official guidance covering:

* California tenant rights
* Security deposits
* Eviction notice types

Relevant sources:

* [California Attorney General - Tenants](https://oag.ca.gov/tenants)
* [California Attorney General - Security Deposits](https://oag.ca.gov/system/files/media/Know-Your-Rights-Security-Deposits-English.pdf)
* [California Courts - Eviction Notice Types](https://selfhelp.courts.ca.gov/eviction-tenant/notice-types)
* [California Courts - Security Deposits](https://selfhelp.courts.ca.gov/fa/node/1268)

Legal information can change and individual situations can depend on additional facts and local rules. Users should verify current official guidance and seek qualified assistance for consequential situations.

---

## Technical Architecture

The application separates natural-language interpretation from legal rules and deterministic logic.

```text
User Story
    ↓
AI / Structured Extraction
    ↓
Validated Case Data
    ↓
Missing-Fact Detection
    ↓
California Rule Data
    ↓
Deterministic Evaluation
    ↓
Plain-Language Explanation
    ↓
Action Plan
    ↓
Letter Generation
    ↓
PDF Export
```

### Core principle

> **AI interprets. Verified rules provide the legal basis. Deterministic logic handles structured checks and calculations.**

This separation is intentional.

It makes the system easier to reason about, test, and constrain than treating a single generated response as the final legal answer.

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

## End-to-End Workflow

The current prototype implements:

```text
Landing
   ↓
Jurisdiction
   ↓
Issue Selection
   ↓
Tenant Story
   ↓
Case Analysis
   ↓
Case Review
   ↓
Rights / Source Information
   ↓
Action Plan
   ↓
Personalized Letter
   ↓
PDF Export
```

The important product output is not just an explanation.

The renter leaves with:

* Structured facts
* Clearly identified missing information
* A relevant verified source
* Plain-language explanation
* Practical next steps
* A personalized action letter
* Downloadable PDF

---

## Validation & Testing

Testing is treated as part of the product.

Current test status:

**234 tests passing across 9 suites**

The test coverage includes:

* Intake behavior
* Structured fact extraction
* Missing-fact detection
* Case analysis
* Case review
* Rule evaluation
* Security-deposit rules
* Date calculations
* Derived calculations
* Adversarial cases
* Verified-rule integrity
* Explanation behavior
* Action-plan generation
* Letter generation
* Case evaluation
* Rule-engine behavior
* User-experience states

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

## Technology Stack

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

### AI & Validation

* OpenAI API
* Zod
* Structured application data
* Deterministic rule evaluation
* Deterministic date calculations

### Document Generation

* pdf-lib

### Development

* Node.js
* ESLint
* TypeScript
* Automated Node test runner

---

## Design Philosophy

RightsPath is intentionally designed to feel more like a trustworthy public-facing civic tool than a generic AI chatbot.

The interface prioritizes:

* Plain language
* Clear hierarchy
* Visible progress
* Readability
* Accessible interactions
* Calm visual design
* Explicit uncertainty
* Source transparency
* Actionable outputs

The product avoids using visual effects as a substitute for trust.

The central UX question is:

> **What does RightsPath know, what does it not know, and what can the renter do next?**

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

## Data & Privacy Design

RightsPath is intentionally lightweight for the prototype.

* The core workflow does not require user accounts.
* Draft case information can be maintained locally during the session.
* The prototype is designed to collect only information necessary for the supported workflow.
* Users should avoid entering unnecessary sensitive personal information.

---

## Limitations

RightsPath is a hackathon prototype with intentionally limited scope.

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

AI coding and development tools, including **Cursor, ChatGPT, and other AI-assisted development tools**, were used during development.

AI assistance was used for development, debugging, iteration, research support, and implementation assistance.

The project creator reviewed and tested the implementation and is responsible for understanding the submitted project.

Within the application itself, AI is used as an interpretation and language-generation layer. Verified legal-rule data and deterministic application logic are intentionally kept separate from the model's generated language.

---

## Hackathon

Built for **LexHack 2026** in the **Access to Justice & Civic Tech** space.

LexHack explicitly includes legal guidance, plain-language assistance, civic technology, and tenant/consumer-rights tools among its project themes.

RightsPath focuses on making the first step after a housing problem more understandable and actionable for renters.

The project emphasizes:

* Real-world usefulness
* Practical implementation
* Technical reliability
* Clear user experience
* Responsible AI use
* Source-grounded legal information
* A concrete user-facing output

[LexHack 2026](https://lexhack-2026.devpost.com/)

---

## Credits

**Project:** RightsPath

**Purpose:** AI-powered tenant-rights intake and action-letter generation

**Jurisdiction:** California, United States

**Development:** Independent hackathon project

**AI development assistance:** Cursor, ChatGPT, and other AI-assisted development tools

RightsPath builds on publicly available legal information and self-help resources published by California government institutions.

---

## Disclaimer

RightsPath provides general legal information and practical guidance.

It is not a law firm, does not provide legal representation, and does not establish an attorney-client relationship.

Information generated by RightsPath should not be treated as a definitive legal opinion.

Users should consult a qualified attorney, legal-aid organization, or appropriate housing resource for advice about their specific circumstances.

---

## License

No open-source license has been added to this repository at this time.

```

[1]: https://lexhack-2026.devpost.com/rules "LexHack 2026: Empowering global student builders to pioneer AI solutions for legal tech, automated law, and AI safety. - Devpost"
[2]: https://github.com/levilabs-hash/rightspath "GitHub - levilabs-hash/rightspath: AI-powered tenant rights intake and action-letter generator for California renters. · GitHub"
