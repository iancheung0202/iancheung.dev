+++
title = "week07"
weight = 9
updated = 2026-11-07T21:33:03Z
+++

# Week 7 Study Guide: Automated Decision-Making (Fairness, Prediction, Risk)

## Big idea

1. Institutions (courts, welfare, insurers, platforms) use algorithms to **sort people** into scores/categories that decide their life chances
2. The **standard narrative** says: algorithms can be "biased" (garbage in, garbage out), so make them **fair = accurate**
3. But accuracy isn't enough. Look at **proxies, who is in the data, feedback loops, and who bears the errors**
4. Fairness misses a lot: **due process, stigma, performativity, agency, institutional goals**
5. ADM works like a **panoptic sort**: surveillance + discipline. It then goes beyond discipline into **nudging** (hypernudges)
6. "Fairness" and "risk" are **not natural**. They are **historical products** (liberalism, insurance, anti-discrimination law, neoliberalism), co-produced with each other
7. Prediction is now a **paradigm** of governance. Always ask: **what does it do, who gets exposed, who gets trusted, who is left out?**

## Eubanks, "The Allegheny Algorithm" (*Automating Inequality*, Ch. 4)

> **Core idea:** The Allegheny Family Screening Tool (AFST) is the *best-case scenario* of child-welfare prediction (open, participatory, well-meaning). Even so, it **profiles the poor**: it confuses **"parenting while poor" with "poor parenting."**

**Opening example**
- Screener **Pat Gordon** + Eubanks guess scores for two families.
- **Stephen** (6, two calls in two weeks, maybe homeless) → score **5**.
- **Krzysztof** (14, cold, cluttered house, mom's long history with county services) → score **14**.
- Why? The family's **history with public services** drove the score, not the severity of the allegation.

**Three places where human choices are baked in**
1. **Outcome variables** = what you predict. Real harm is too rare to model, so they use **proxies**:
   - **Community re-referral** (another hotline call within 2 years)
   - **Child placement** (foster care within 2 years)
   - → So AFST predicts **decisions** (who gets reported, who gets removed), **not actual maltreatment**.
2. **Predictive variables** = **131** factors kept out of **287** tested (via **stepwise probit regression**, "data dredging"). **Correlation ≠ causation** (shark attacks / ice cream / summer).
   - ~**1/4** are direct measures of **poverty** (TANF, SNAP, SSI, Medicaid)
   - ~**1/4** are contact with **CYF / juvenile probation**
3. **Validation data** = 76,964 past referrals (70% train / 30% test). Accuracy **AUC = 76%** (50% = coin toss, 100% = perfect, "about a mammogram"). On 15,139 reports in 2016 → **~3,633 wrong predictions** (false positives *and* false negatives).

> **Is ADM "inherently political"?** Eubanks says, it "shatters the social safety net, criminalizes the poor... reframes shared social decisions... into **systems engineering problems**."

**Core arguments**
- **Data only covers people who use public services.** Rich families use private therapists/nannies/rehab, which is **invisible** in the data. → "We definitely oversample the poor" (Dalton). This is **poverty profiling** (like racial profiling).
- **Bias enters at referral, not screening.** A 2010 county study: disproportionality comes from **who gets called in on** (neighbors, mandated reporters), not screener decisions (69% vs 65% screen-in). But AFST uses **call referral as a proxy**, so it bakes in the exact bias.
  - 2016: Black kids = **48%** of foster care, but **18%** of county kids.
- **Nuisance/malicious calls** (~4% of reports) contaminate the data. Anonymous reporting is allowed. (Example: Angel & Patrick's daughter **Harriette**, repeated false calls.)
- **Mandated reporters + help = surveillance.** The people who help poor parents (teachers, doctors, therapists) must report them. So asking for help can raise your risk. **Privacy and due process are the price of services.**
- **Durability:** records are kept **forever**, with no expungement. Harriette will start with a higher score as a future parent.
- **Feedback loop / performativity:** high score → more scrutiny → more re-referrals → "model was right." The tool may **create the abuse it predicts** (isolation, stress, avoiding help).
- **Human-in-the-loop doesn't fix it.** Screeners are told to override, but managers say if your judgment doesn't match the score, "you're missing something." The algorithm is **training the workers**. (Automation bias: machines seem neutral.)
- **Human vs. machine bias:** automated discretion = **"the discretion of the few"**, human discretion = **"the discretion of the many"**. Human bias is "flawed and fallible, but also **fixable**." (you can't fix a number.)
- **Machines as "transparent," humans as "black boxes"** is a troubling worldview (gives up on empathy and understanding).
- **"Models are opinions embedded in mathematics"**.

## Fourcade & Healy, "Classification Situations" (*The Ordinal Society*, ch. 3)

> **Core idea:** Machines classify because people do, but digital data lets institutions generate **new, behavioral, probabilistic categories** that decide **life chances**. We increasingly live in an **ordinal society** (ranked by scores).

- **Data double:** the version of you reconstructed from your data traces.
- **Panoptic sort**: a "difference machine" that sorts people by routine measurement and allocates opportunities. Always expanding; "a system of power."
- **Classification situation:** your *position in a generated system of categories* that matters for your **life chances**. Often **postdemographic** (not race/gender, but behavioral/predictive).
- **Nominal vs. ordinal:**
  - **Nominal** = naming kinds ("what is it?"). Often has hidden hierarchy (marked vs. unmarked).
  - **Ordinal** = ranking by score/position ("how much / where?"). Qualitative ranking (purity tests, shibboleths) can discipline just as much. The novelty is **fusing naming + ranking with massive data**.
- **ML classifiers fail** because training data comes from an **already structured, unequal world**:
  - Facial recognition misgenders Black women; Amazon's hiring tool learned to penalize women.
  - Groups heavily policed/surveilled are **overrepresented** in data.
  - **Shortcut learning:** pneumonia X-ray model learned **which hospital** the image came from, not pneumonia.
  - Opaque models are hard to **validate, audit, or contest**
- **Eigencapital**: your accumulated, multidimensional data position that gives advantages.
  - **Embodied:** feels like ease (skip the line, smoother transactions, shorter waits). "The unbought grace of life," now quantified.
  - **Objectified:** you work to produce "good data" (build credit, manage your score).
  - **Institutionalized:** a single circulating score (credit score, China's social credit, Airbnb "trustworthiness" patent).
- **Visibility and invisibility are both traps.** Not being in the data is coded as suspicious (no credit history = bad score). Those outside the system are the **"lumpenscoretariat."**
- **Waiting time ≈ power**: call centers now automate who waits via "customer importance scores."

## Lecture 16: Fairness (Automated Decision-Making I)

> **Core idea:** The standard "algorithmic bias" story frames fairness as **accuracy**. A sociotechnical view sees fairness as **contextual, contested, and political**.

**Case: COMPAS** (risk scores for bail, parole, sentencing)
- **ProPublica:** not fair, because **error rates differ by race**:
  - Labeled higher risk but didn't re-offend: **44.9% Black vs 23.5% white**
  - Labeled lower risk but did re-offend: **28.0% Black vs 47.7% white**
- **Northpointe:** fair, because scores are **calibrated**: a "7" means about the same re-offend rate (60% white, 61% Black).
- **Both are mathematically incompatible** when base rates differ. **Both assume fair = accurate.**

**Standard narrative: "GIGO" (garbage in, garbage out).** First steps beyond it:
- **Representation:** What are you actually predicting? What do the data *represent*? What **proxies** and **ground truth**? (What is "recidivism"? What is a crime?)
- **Problematic proxies:** health *costs* used as proxy for health *needs* → Black patients at the same risk score were sicker (less money spent on them).
- **Intersectionality** facial classifiers perform worst on **darker-skinned women**.
- **Social significance of errors:** vulnerability to error depends on **positionality** (e.g., Cook County property-tax errors harmed the poor, helped the rich).
- **"Fairness = accuracy?"** Anti-discrimination-law framing: fair = "do error rates vary across protected classes?" But decision algorithms are **supposed to "discriminate"**. Fairness → accuracy turns a **social problem into a technical one**.
- **Fairness is not one natural thing.** Who decides? Who *should* decide? (power)

**Takeaway:** Too much focus on "bias/fairness" can **obscure the systemic issues** behind technical failures.

## Lecture 17: Prediction (Automated Decision-Making II)

> **Core idea:** Look at ADM **beyond fairness**, and see it as a **form of governance** (panoptic, disciplinary).

**Case: Ofqual (UK, 2020).** An algorithm downgraded A-level results since exams were canceled in COVID. Students protested that the algorithm doesn't know them. *Even if it's perfectly accurate, would it be fair?*

**Fairness beyond accuracy**
- **Due process / procedural rights** (5th & 14th Amendments); predictive policing vs. **4th Amendment** (unreasonable search).
- **Representation:** being labeled "risky" **stigmatizes**; **circulation and durability** of tags across databases.
- **Performativity:** predictions as **self-fulfilling prophecy** via feedback loops (e.g., predictive-policing hot spots).
- **Agency:** predictions **restrict or foreclose** what people can do.
- **Institutions:** Does a "human-in-the-loop" fix bias? **Who is responsible** when it goes wrong? Risk assessment reshapes institutional goals and becomes a **category of "good governance"** (**co-production**).

Rule of law, **judge as automaton**, rules replace subjectivity, "objectivity is an adaptation to the **suspicions of powerful outsiders**."
- "Decision-making" as a concept is **post-1940s**; models of rational decision-making are **co-produced with managerial social order**.

**Cybernetic choice architecture**
1. User decision → 2. turned into data → 3. assessed against institutional goals → 4. choice architecture reconfigured to nudge. (Continuous, dynamic, personalized. Google Maps rerouting ≈ a digital speed bump.)
- **Personalization at the level of populations** (Zuboff, Facebook voting experiment).

## Lecture 18: Risk (Automated Decision-Making III)

> **Core idea:** **Fairness and risk assessment have a history.** They rose together in the 1970s and are **co-produced with neoliberalism**. Risk assessment became a **template for governance**.

**History of risk (the timeline to know)**
1. **Early capitalism:** actuarial methods + **marine insurance** (17th c.)
2. **Industrial revolution:** **collectivizing risk**: workmen's compensation, accidents; **Quetelet's "average man"** / bell curve → population-level thinking
3. **Welfare state:** **New Deal / Social Security (1930s)**, a socialized pool where risk is shared (**liberal egalitarianism**)
4. **Individualizing risk:** **private life insurance**, **"actuarial fairness"** (you pay for *your own* risk). **Panoptic discipline + biopower** (Bouk, *How Our Days Became Numbered*)
5. **Unisex insurance debates (1970s):** feminists said sex-based pricing was discrimination; industry said **sex-based pricing was actuarially "fair"** (Horan, *Insurance Era*)
6. **Neoliberalism:** erosion of welfare state (e.g., Reagan firing air-traffic controllers 1981); **automating public welfare** (1970s-80s)
7. **Today:** computing + granular data → **individualized** risk (car telematics, credit) → **personalization** → **prediction as paradigm** (AI, prediction markets, "how everything became gambling")

**Why it matters:** "Actuarial fairness" = **fairness as individual responsibility for your own risk**. This **truncates more radical claims to social equality**. Risk assessment, actuarial fairness, and neoliberalism **co-produced** each other.
