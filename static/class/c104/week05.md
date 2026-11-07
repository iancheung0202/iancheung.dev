# Week 5 Study Guide: Privacy

## Big Picture

> **Privacy is not one simple, natural thing.** Our current legal/technical approach (Fair Information Practices, PII, notice-and-consent) was built in the **1970s U.S.** out of fear of **big government databases**. It treats privacy as **individual control over personal information**. In today's **datafied world** (data circulation, ML, tracking, inference), that approach falls short. **Contextual integrity (CI)** is a better tool: privacy = *appropriate information flows* that match the *norms of a context*. Pressly goes further: even CI still assumes information *already exists*. His argument is that privacy's real value is **preventing information from being created** in the first place and protecting **oblivion**.

## Lecture 11: Privacy Foundations

### Main claim
> **Privacy is not one simple, natural thing.** The word bundles many ideas: freedom of thought/speech, control over your body, solitude at home, control over personal info, right to be forgotten, freedom from surveillance, protection of reputation, protection from searches. **It is sociotechnical** and **contingent**. It came from a particular history, not from nature.

### Fair Information Practices (FIPs / FIPPs)
1. **Notice / Awareness**: no secret record-keeping systems; you can find out what's in your record and how it's used.
2. **Choice / Consent**: you can stop info collected for one purpose from being used for others without your consent.
3. **Access / Participation**: you can correct your record.
4. **Integrity / Security**: organizations must keep data reliable and prevent misuse.
5. **Enforcement / Redress**: formal enforcement and ways to fix/compensate harm.

### Personally Identifiable Information (PII)
- NIST definition in U.S. security/privacy law: (1) info that can *distinguish or trace* identity (name, SSN, biometrics) plus (2) any info *linked or linkable* to an individual (medical, financial, etc.).

### Technical contributions
1. **De-identification / re-identification**: removing name, SSN, etc. is **not foolproof.**
   - **Latanya Sweeney (2002)**: **87% of Americans** uniquely identified by **zip code + birth date + gender** (linked medical data to voter list).
   - **Netflix Prize dataset (2006-07)** users can be re-identified easily, and second contest canceled after privacy lawsuit.
2. **Differential privacy** (Cynthia Dwork et al., 2000s): privacy loss can be *mathematized*; add **random noise** to prevent re-identification while keeping analysis useful. Example: **2020 U.S. Census.** Can be used for ML training data.

### Limits of the inherited paradigm
This 1970s framework:
- Focuses on **individuals' personal info/PII**, not collective impacts.
- Relies on **individual self-management** decisions (usually at sign-up).
- Assumes **moment-by-moment** decisions, not **cumulative effects**.
- Assumes the issue is **controlling movement of existing info**, not preventing its creation.
- **Equates ethical with legal**, which quietly narrows the discussion.

New problems it doesn't handle: data circulating far beyond original context, re-identification by merging datasets, new modes of collection, easy surveillance, algorithmic judgments/predictions, ML training sets, data capitalism.

## Lecture 12: Privacy in the World

### Terms of service
- Clicking "sign up" = you enter a **legal relationship**; you get the service in exchange for **information**.
- Problems: puts the **work on the user**; options are basically **binary** (opt in or don't participate), which steers you to opt in; companies can **assume users don't read**; it's all about "you" (individual).

### Examples

**Case 1: Havasupai blood samples**
- Havasupai tribe gave blood samples to Arizona State University researchers; samples were used for research beyond what they expected (returned in 2010).
- Lessons: **Identity/positionality** is *collective and relational*, not just individual. **Consent, but not just consent.** **Sovereignty** (self-governance) is more than ownership, tied to **colonial relations and histories**.
- Takeaway: **expectations, relationships, and contexts matter.**

**Case 2: Crisis Text Line (2022)**
- Crisis Text Line (mental health crisis hotline, nonprofit) shared conversation data with **Loris.ai**, a for-profit AI spin-off (machine learning to make customer support "more human/empathetic"). CTL stopped after criticism.
- Data was "anonymized," "scrubbed of PII," and users had "consented" → so **FIPs/PII thinking says it's fine.**
- Shortcomings: manipulates expectations of caring human relationships; **consent in moments of crisis** is questionable; **contextual shift** (personal trauma → automated customer service); commercial product **without compensating the people who provided the data**; benefit ≠ who provides data; where's the responsible line between **non-profit and for-profit**?

**Case 3: TSA semi-automated body scanners**
- TSA did a Privacy Impact Assessment with FIPs; **disabled data storing, blurred faces, collected no other PII.** Later moved to generic outline avatars (DHS 2022 measures for transgender/non-binary travelers).
- Shortcomings: **privacy here isn't about PII!** It's about the **body, dignity, values, norms**; **categorization** (male/female bodies as the norm, "normal vs abnormal"); **power dynamics**: some people get extra screening, who is seen as suspicious/a threat.

### Limits of "privacy as individual control" in the datafied world
- Implications go **beyond the individual who consents**; strong incentives to get consent unobtrusively; is the individual (signing up in advance) even the right agent?
- Harm happens even with **non-identifiable info**: **metadata**, **inferences/correlations/ML**.
- Too many data sources to combine; **user exhaustion**; data **reused far beyond context of collection**.
- What's at stake is more than privacy: **discriminatory treatment, manipulation, decisional interference, dignity, sense of self.** People already experience privacy/exposure differently based on **power**.

## Reading: Malkin, "Contextual Integrity, Explained"

### Core thesis
> Privacy = **appropriate data flows**, judged by conformity with **expectations**, between people in **relationships**, in specific **contexts**.
- A context has **integrity** that must be respected for people to feel privacy is secure.
- Helps identify **what causes privacy problems** (e.g., **context shifts**) and suggests technical moves: collect least data possible; use it with respect.
- Dictionary definitions of privacy are too vague. Laws (GDPR, CCPA) don't define privacy; they list rights and duties. Something can be **legal yet feel like a violation**.
- We need a **model** that explains past privacy scandals and predicts future ones.

### The four ideas
1. **Privacy = appropriate information flow.**
   - Info flow = transfer of knowledge from one party to another (patient → nurse → doctor → computer → hacker...).
   - Rejects **binary models** (secret vs. not, private vs. public, sensitive vs. not). Example: you tell your doctor health info and your accountant finances, but it would feel wrong if your accountant asked for your medications. And *public* info (store visits) becomes invasive when **aggregated into a profile**.
2. **A flow is appropriate if it matches contextual norms.**
   - Privacy is violated when flows **breach legitimate contextual informational norms.**
   - This is **not procedural**: following FIPPs/informed consent/encryption isn't enough. "Clicking 'I accept'" doesn't make problems vanish.
   - **Norms** = commonly held expectations. Can be explicit/implicit, legal/social, local/societal, changing. Examples: teacher shares grades with guardians only; therapist keeps confidences unless patient in danger; citizens report income but government doesn't publish it.
   - Norms must come from **real people's expectations** (find out by asking), not derived from first principles or one person's opinion.
3. **A norm has (at least) 5 parameters:** **data type** (what info), **data subject** (who it's about), **sender**, **recipient**, and **transmission principle** (constraints on the flow: consent, warrant, notice, reciprocity, legal requirement, Chatham House Rule...)
   - If **one parameter changes**, the whole flow may become inappropriate.
   - Actors are **roles**, not identities (your doctor who is also your friend).
   - **Purpose/use** may deserve its own parameter. Example: smart speaker data used to answer queries = fine; used for advertising = company switches role to *advertiser*.
4. **New flows are evaluated through context** using 3 layers: interests of affected parties, ethical/political values (justice, equity, free speech), and **contextual functions, purposes, and values** (e.g., does it undermine the purpose of health care?). A new flow can be *good* (e.g., disease outbreak notification to public health).

### Four practical lessons
1. **Think beyond binaries.** Example: **voice assistants (Alexa) using human contractors** to listen to recordings: data never left the company, but the *new flow* (humans listening, permanent record) broke expectations.
2. **Check expectations, not checklists.** Fine print isn't a defense. Even PETs can fail: **private browsing** misunderstood; **Do Not Track** header itself became a **fingerprinting** signal.
3. **Account for the complete context.** Social media "Like/Share" buttons are fine on news sites, but questionable on health sites. People are wary of **humans (vs. machines)** seeing data and of **third-party sharing**.
4. **Consider the consequences**: link to contextual *purposes*. Example: **remote proctoring / student surveillance**: does it help or hurt learning?

### Limits of CI
- It's a **model to predict feelings**, not how people actually think; people act on emotions/intuition.
- There may be other factors beyond five parameters.
- It favors established norms (e.g., workplace **salary secrecy** norm may hurt workers/minorities).
- Harmless data can be composed into invasive profiles (famous example: store predicting a **woman's pregnancy** from shopping history). CI's answer: **higher-order/inferred data should be judged on its own terms**; expectations "travel down" to the source data.

## Reading: Pressly, *The Right to Oblivion*

### Core thesis
> Privacy is valuable **not because it lets us control information**, but because it **protects against the creation of such information in the first place.** Privacy protects and produces **oblivion.**

### Key arguments
1. **We are "blinded by information."** More information ≠ seeing more clearly. We lose sight of valuable areas of life that depend on **limits to what is knowable.** ("You are your data"; people called "data subjects"; conversation as "exchange of information.") Like being "impoverished by money": you view too much of life in dollars and cents.
2. **"Nothing in excess"**: the Delphic maxim next to "know yourself." Herzog: a house becomes uninhabitable if you **illuminate every dark corner**; same for a marriage.
3. **The Ideology of Information**: the unspoken assumption that **information naturally exists** in human affairs and that **any aspect of life can be turned into data.** It:
   - **Naturalizes** the existence of personal information *before* asking what privacy is for.
   - Reduces privacy debates to "control, protect, or restrict access to info that already exists."
   - Serves **surveillance states and capitalists** (Marx: ruling ideas = ideas of the ruling class). It marks the "boundaries of resource extraction."
   - By the time you use "privacy settings," **"it's already too late"**: the platform already has the data.
4. **Even privacy's defenders fall for it.** The Stanford Encyclopedia's "informational privacy" definition, and views like **contextual integrity**, "control," "access," "flows," accept the information framing. Companies touting new "privacy features" is cheerleading for a diminished value of privacy.
5. **Neoliberal critique (Bernard Harcourt):** privacy shifted from a **humanistic value** to something with **costs and benefits**, a **type of property** that can be **bought and sold in a market.** ("Privacy settings," privacy policies, services traded for data.) Pressly says the consent critique (coercion, power asymmetry) is true but **doesn't address privacy as such.**
6. **Privacy ≠ secrecy ≠ hiding ≠ anonymity ≠ confidentiality.**
   - **Secret**: must be *known definitively* by someone; durable (shared secrets still secret; enables blackmail). Kid says "It's a secret" (fine) vs. "It's private" (odd). "Secret life" vs. "private life."
   - **Privacy**: not durable, is *violated/destroyed* when breached. A Peeping Tom can't "be in on" your privacy.
   - **"Nothing to hide" slogan** is fatuous, because **hiding is for those with something to hide; privacy is for something else.**
   - A **lie** can preserve a secret but **not privacy**, because it *creates* information (false) where there was none.
7. **Oblivion** = a form of not-knowing where there is **no fact of the matter**, only **ambiguity and potential**; can't be said to be "x or not x." It's resistant to articulation. It's **not a void**; it can be *encountered and respected* in daily life.
   - Root: Latin *oblivio* (forgetting). Connects to being **"oblivious"** (not knowing *and not suspecting* there's anything to know), **right to be forgotten**, **Acts of Oblivion** (Treaty of Westphalia, 1648: "perpetual Oblivion" after war).
   - Respecting privacy = **deliberate obliviousness**: "It is as if it never happened," not just "I won't tell anyone."
   - Examples: neighbors arguing through the wall (overhearing ≠ violation, but **keeping a journal or putting your ear to the wall** shifts from obliviousness to suspicion); a pushy acquaintance treating you as a "repository of information" instead of a person with unknown depths; the hidden camera in a park (obliviousness vs. mystery vs. suspicion feel different).
8. **History matters**: modern privacy began in the **19th century** with the reaction to **snapshot photography** and mass media, opposing "humanistic moral rhetoric" to anti-human threats. Worries about "the end of privacy" are as old as the "information age" (mid-19th c.: photography, newspapers, Bertillon biometrics). Today's biggest novelty may be **acceptance of the ideology of information**, not any specific technology.
9. **Citizen's vs. artist's sense of privacy (Joshua Rothman):** citizen = protect from others using info against us; artist (Woolf) = preserve **life's mystery**, leave things undescribed. Pressly argues these are *not* really separate; the civic idea of privacy has always been animated by the artist's sense.
