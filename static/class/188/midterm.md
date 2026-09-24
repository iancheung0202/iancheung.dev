# CS 188 Midterm Study Guide

## 1. Search

### 1.1 Search Problem Components

A search problem = **(states, actions, transition model, action cost, start state, goal test)**.

* **World state**: all information. **Search state**: only what's needed for planning (space efficiency).
* **State space size**: use the *fundamental counting principle* — multiply the number of possibilities for each independent variable object (e.g., position × direction × ghost positions × food-boolean combos).

### 1.2 State Space Graphs vs. Search Trees

* **State space graph**: each state appears **exactly once**. Usually too big to store.
* **Search tree**: each node = a *path* from start; states can repeat. Built on-demand via `getSuccessors`/actions/costs.

### 1.3 Uninformed Search — properties table

| Strategy | Fringe | Complete? | Optimal? | Time | Space |
| --- | --- | --- | --- | --- | --- |
| **DFS** | Stack (LIFO) | No (infinite branches/cycles) | No | $O(b^m)$ | $O(bm)$ |
| **BFS** | Queue (FIFO) | Yes | Only if all costs equal | $O(b^s)$ | $O(b^s)$ |
| **UCS** | Priority queue by backward cost $g(n)$ | Yes | Yes (costs $\ge 0$) | $O(b^{C^*/\varepsilon})$ | $O(b^{C^*/\varepsilon})$ |

* $b$ = branching factor, $m$ = max depth, $s$ = depth of shallowest solution, $C^*$ = optimal cost, $\varepsilon$ = min edge cost.
* **Key pattern**: if all costs = 1, UCS $\equiv$ BFS.
* **Branching factor** for "choose 2 of $s$ items" type problems $\approx O(s^2)$, not $O(s)$.
* Multiple distinct paths to the same goal can exist even without repeated elements — order of operations differs.

### 1.4 Informed Search

**Heuristic $h(n)$**: estimate of cost from $n$ to nearest goal. Usually derived from a **relaxed problem** (remove constraints, e.g. ignore walls → Manhattan/Euclidean distance).

* **Greedy search**: priority = $h(n)$ only. Fast but not complete/optimal.
* **A* search**: priority = $f(n) = g(n) + h(n)$ (backward + forward cost estimate). Complete & optimal **if heuristic is admissible** (tree search) or **consistent** (graph search).

**Admissibility**: $0 \le h(n) \le h^*(n)$ for all $n$ (never overestimates true cost to goal). Required for A* **tree search** optimality.

**Consistency**: $h(n) \le \text{cost}(n, n') + h(n')$ for every edge (triangle inequality). Consistency $\Rightarrow$ admissibility. Required for A* **graph search** optimality (an inconsistent-but-admissible heuristic keeps A* graph search **complete** but may lose **optimality**).

**Combining heuristics**: $\max(h_1, h_2, \ldots)$ of admissible heuristics is admissible and dominates each individually. Sum of two admissible heuristics is generally **not** admissible (can double count).

**Dominance**: $h_a$ dominates $h_b$ if $h_a(n) \ge h_b(n)$ for all $n$ (both admissible). Bigger-but-still-admissible = better/faster.

**Building admissible heuristics — common exam patterns:**

* Distance-based lower bounds (Manhattan, Euclidean, "furthest unvisited item," "count of unvisited items") are usually admissible if they under-count required steps.
* A heuristic that can be more than 1 unit away from the true "1 step to goal" cost while claiming a small gap is often admissible but **not consistent** — check by comparing heuristic drop vs. actual edge cost.
* Heuristics involving resources that aren't required to be depleted/full at the goal (e.g., "unused power cell count," "battery charge") are typically **not admissible** unless the goal test constrains that resource.

### 1.5 Graph Search

Tree search + a **reached/closed set** to avoid re-expanding states. For A* graph search to stay optimal, you must re-expand/update a state if you find a **cheaper** path to it (check $\text{reached}[state] > \text{new cost}$ before finalizing).

### 1.6 Local Search (no path needed, just the goal config)

* **Hill-climbing**: move to best neighbor; incomplete (stuck at local maxima/plateaus/shoulders). Random-restart hill-climbing is complete.
* **Simulated annealing**: allows "bad" moves with probability based on a decreasing temperature; converges to global max as $T \to 0$ slowly.
* **Local beam search**: tracks $k$ states simultaneously, chooses best $k$ successors from combined pool (not $k$ independent hill-climbs).
* **Genetic algorithms**: population + fitness-proportional selection + crossover + mutation.

## 2. Constraint Satisfaction Problems (CSPs)

### 2.1 Definition

CSP = (Variables $X_1, \ldots, X_n$, Domains, Constraints). Goal: assignment satisfying all constraints (an **identification** problem — no cost to minimize, order doesn't matter).

* **Unary constraint**: involves 1 variable → pruned into domain directly, not drawn as an edge.
* **Binary constraint**: involves 2 variables → edge in constraint graph.
* **Higher-order constraint**: 3+ variables → drawn as a hyper-edge/shared node.

### 2.2 Solving: Backtracking Search

DFS + (1) fixed variable ordering, (2) only assign values consistent with existing assignments (fail fast).

### 2.3 Filtering

* **Forward checking**: after assigning $X_i$, remove values from **domains of unassigned neighbors** that violate the constraint with $X_i$'s new value.
* **Arc consistency (AC-3)**: for arc $X_i \to X_j$, remove any value $v$ in $\text{Dom}(X_i)$ if there's **no** value $w$ in $\text{Dom}(X_j)$ making $(v,w)$ consistent. If you prune from $X_i$, re-add all arcs $X_k \to X_i$ $(k \ne j)$ to the queue. Runs until queue empty or a domain empties (triggers backtrack).
* **Important asymmetry**: arc $A \to B$ consistent does NOT imply $B \to A$ consistent — check both directions separately.
* AC-3 worst case: $O(ed^3)$, $e$ = #arcs, $d$ = max domain size.


* Forward checking = special case of enforcing arc consistency only on arcs into newly-assigned-adjacent variables (weaker than full AC-3).

### 2.4 Ordering Heuristics

* **MRV (Minimum Remaining Values)**: pick the unassigned variable with the **smallest domain** next (fails fast).
* **LCV (Least Constraining Value)**: pick the value that **prunes the fewest options** from neighbors' domains.

### 2.5 Structure Exploitation

* **Tree-structured CSP** (no cycles in constraint graph): solvable in **$O(nd^2)$** via:
1. Pick a root, orient edges away from root (topological order).
2. Backward pass: enforce arc consistency $\text{Parent}(X_i) \to X_i$ from last to first.
3. Forward assignment: assign each $X_i$ a value consistent with its parent, in topological order — guaranteed to succeed.


* **Cutset conditioning**: find smallest **cutset** (variable removal set) that makes remaining graph tree-structured. Try all $d^c$ assignments to the cutset, solve the resulting tree CSP for each. Runtime: $O(d^c (n-c) d^2)$.
* A CSP with $\text{AllDiff}(X_1, \ldots, X_n)$ (all pairwise inequalities) → **fully connected** graph.
* A CSP with $\text{AllDiff}(X_i, X_{i+1})$ chain constraints → **tree-structured (linear chain)** graph.
* To find a cutset of size 1 that disconnects a chain-like AllDiff structure: remove a "shared"/middle variable connecting sub-cliques.

### 2.6 Local Search for CSPs

**Min-conflicts heuristic**: pick a random conflicted variable, reassign to the value **minimizing the number of violated constraints** (ties broken arbitrarily — all minimizing values are valid answers). Very fast in practice, especially for large CSPs, but incomplete.

## 3. Adversarial Search / Games

### 3.1 Game Formulation

(Initial state $s_0$, $\text{Players}(s)$, $\text{Actions}(s)$, $\text{Result}(s,a)$, $\text{Terminal-test}(s)$, $\text{Utility}(s, \text{player})$)

### 3.2 Minimax

* **Value of state**: $V(s) = \max_{s' \in \text{successors}(s)} V(s')$ if agent-controlled, $V(s) = \min_{s' \in \text{successors}(s)} V(s')$ if opponent-controlled, known value if terminal.
* Assumes opponent plays **optimally against you** (adversarial/zero-sum assumption).
* Traverses like DFS/postorder: $O(b^m)$ time, $O(bm)$ space.

### 3.3 Alpha-Beta Pruning

* Prune a branch when you know it **cannot** affect the value at an ancestor decision node — i.e., a min node's current best-so-far is already $\le$ the max ancestor's best-so-far ($\alpha$), or vice versa ($\beta$).
* **Does not change the root value**; may prune nodes but never changes correctness.
* Best case runtime: $O(b^{m/2})$ — doubles effectively-searchable depth, requires good move ordering.
* **A node whose value directly bounds a sibling/ancestor decision can never be safely pruned** if it's the deciding comparison (e.g. the very first child compared at a min/max node providing the initial bound must always be visited).

### 3.4 Expectimax

* Adds **chance nodes**: $V(s) = \sum_{s'} P(s'\mid s) \cdot V(s')$ — average, not min/max.
* Use when opponent/environment is **not adversarial** (random or otherwise suboptimal/known-distribution).
* **Cannot prune the same way as minimax** in general (no known finite bounds $\Rightarrow$ any child could swing the average arbitrarily), unless values are bounded.
* Minimizer = special case of chance node (puts all probability mass on the worst outcome for you).

### 3.5 Mixed/General Trees

* Node types can freely alternate (multiple ghosts, mixed min/chance/max layers) — just apply the correct rule per layer.
* **General-sum games**: utility is a **tuple** (one value per player); each player maximizes *their own* coordinate at nodes they control.
* Zero-sum games: adding an extra action to **minimizer** nodes can only **decrease or keep the same** the max-node ancestor value; adding extra action to **maximizer** nodes can only **increase or keep the same** the value. For expectimax: extra action at chance nodes → value can go **any direction**; extra action at maximizer nodes (with chance-node parents) → root can only **increase or stay the same**.

### 3.6 Evaluation Functions

Used at depth-limited cutoff instead of true terminal utility. Typically a **linear combination of features**:

$$\text{Eval}(s) = w_1 f_1(s) + w_2 f_2(s) + \cdots + w_n f_n(s)$$

Weight sign/magnitude reflects feature importance and whether it helps/hurts the agent.

### 3.7 Monte Carlo Tree Search (MCTS)

For huge branching factors (e.g., Go). Loop: (1) use UCB to descend to an unexpanded leaf, (2) expand + rollout to get win/loss, (3) backpropagate result.

**UCB1**:

$$\text{UCB1}(n) = \frac{U(n)}{N(n)} + C \sqrt{\frac{\log N(\text{parent})}{N(n)}}$$

— first term = exploitation (win rate), second = exploration bonus (favors less-visited nodes). As $N \to \infty$, UCT → minimax behavior.

## 4. Markov Decision Processes (MDPs)

### 4.1 Definition

(States $S$, Actions $A$, Transition function $T(s,a,s') = P(s' \mid s,a)$, Reward $R(s,a,s')$, start state, discount $\gamma$, possibly terminal states).

* **Markov property**: $P(s_{t+1} \mid s_t,a_t,\ldots,s_0) = P(s_{t+1} \mid s_t,a_t)$ — memoryless. If a problem needs history (e.g., "has visited X before," "actions taken so far," "used-once actions") that info **must be added to the state**, or the Markov property is violated.
* **Q-state / action state**: $(s,a)$ — like an expectimax chance node; agent spends 0 time here.
* **Discounted utility**: $U = R_0 + \gamma R_1 + \gamma^2 R_2 + \cdots$; converges iff $\vert{}\gamma\vert{} < 1$ (bounded by $R_{\max}/(1-\gamma)$).

### 4.2 Bellman Equation (optimality condition, not an algorithm)

$$V^*(s) = \max_{a} \sum_{s'} T(s,a,s') \left[ R(s,a,s') + \gamma V^*(s') \right]$$

$$Q^*(s,a) = \sum_{s'} T(s,a,s') \left[ R(s,a,s') + \gamma V^*(s') \right]$$

$$V^*(s) = \max_{a} Q^*(s,a)$$

### 4.3 Value Iteration

$$V_0(s) = 0 \text{ for all } s$$

$$V_{k+1}(s) \leftarrow \max_{a} \sum_{s'} T(s,a,s') \left[ R(s,a,s') + \gamma V_k(s') \right]$$

Iterate until convergence ($V_{k+1}(s) = V_k(s)$ for all $s$). This is the **Bellman update/operator** — a **contraction by $\gamma$** in max-norm, which guarantees convergence.

* $V_k(s)$ = value with a **k-step horizon** (= depth-k expectimax value).
* Runtime per iteration: $O(\vert{}S\vert{}^2 \vert{}A\vert{})$.

**Q-value iteration** (same idea, one level later):

$$Q_{k+1}(s,a) \leftarrow \sum_{s'} T(s,a,s') \left[ R(s,a,s') + \gamma \max_{a'} Q_k(s',a') \right]$$

### 4.4 Policy Extraction

$$\pi^*(s) = \operatorname*{argmax}_{a} \sum_{s'} T(s,a,s') \left[ R(s,a,s') + \gamma V^*(s') \right]$$

Cheaper if you already have optimal **Q-values** (just argmax, no re-computation needed).

### 4.5 Policy Iteration

1. Start with arbitrary policy $\pi_0$.
2. **Policy evaluation**: solve $V^{\pi}(s) = \sum_{s'} T(s,\pi(s),s') \left[ R(s,\pi(s),s') + \gamma V^{\pi}(s') \right]$ — a linear system (no max needed since action is fixed), or iterate to convergence.
3. **Policy improvement**: $\pi_{i+1}(s) = \operatorname*{argmax}_{a} \sum_{s'} T(s,a,s') \left[ R(s,a,s') + \gamma V^{\pi_i}(s') \right]$.
4. Repeat until policy stops changing → optimal.
5. Converges in **fewer iterations** than value iteration typically (policies converge faster than values), though each iteration can be more expensive.

### 4.6 Reading the reward/discount structure (common exam traps)

* If discount $\gamma$ affects **only** a uniform final-multiplier (single terminal reward, fixed horizon), then changing $\gamma$ ($\gamma<1$) does **not** change the optimal policy — only scales values uniformly.
* If $\gamma=0$, agent is fully myopic: $Q(s,a) = \sum_{s'} T(s,a,s') R(s,a,s')$, i.e., maximize **immediate expected reward only**.
* To find smallest $k$ where $V_k(s)$ becomes nonzero/optimal: trace which states get nonzero reward first (adjacent to reward states), then propagate outward one "hop" per iteration.
* **State-space reduction**: if only relative quantities matter (e.g., score difference, not raw scores) for both transitions and rewards, you can collapse variables into their difference without changing the optimal policy. But **do not** discard information required to compute the transition/reward (e.g., turns remaining, or an opponent's score if only used via a difference term you didn't keep).

## 5. Reinforcement Learning (RL)

### 5.1 Big Picture

Online planning: transition/reward functions are **unknown**. Agent must **explore** (act, observe $(s,a,s',r)$ samples) to learn, then **exploit**.

* **Sample**: one $(s,a,s',r)$ tuple. **Episode**: a sequence of samples ending in a terminal state.
* **Model-based learning**: estimate $\hat T(s,a,s')$ and $\hat R(s,a,s')$ via counting/averaging observed transitions, then run value/policy iteration on the estimated MDP.
* $\hat T(s,a,s') = \dfrac{\text{count}(s,a,s')}{\text{count}(s,a)}$.


* **Model-free learning**: skip the model, estimate values or Q-values directly from samples.

### 5.2 Passive RL (fixed policy $\pi$, learn its value)

**Direct evaluation**: for each state, average the **total observed return** across all visits under $\pi$. Simple but slow — ignores the fact that neighbor states' returns are correlated via the Bellman equation, so it "wastes" transition information and has high variance.

**Temporal Difference (TD) Learning**: update after every single transition using an exponential moving average:

$$\text{sample} = R(s,\pi(s),s') + \gamma V^{\pi}(s')$$

$$V^{\pi}(s) \leftarrow (1-\alpha)\, V^{\pi}(s) + \alpha \cdot \text{sample}$$

* $\alpha$ = learning rate $\in [0,1]$. Learns online, weights older samples exponentially less. Faster convergence than direct evaluation.
* TD learning and direct evaluation are both **on-policy** (they evaluate the policy being followed).

### 5.3 Active RL — Q-Learning

Learns **Q-values directly**, no model needed at all, and learns the *optimal* policy even while acting suboptimally/randomly (**off-policy**):

$$\text{sample} = R(s,a,s') + \gamma \max_{a'} Q(s',a')$$

$$Q(s,a) \leftarrow (1-\alpha)\, Q(s,a) + \alpha \cdot \text{sample}$$

Equivalently: $Q(s,a) \leftarrow Q(s,a) + \alpha \cdot [\text{sample} - Q(s,a)]$ ("shift toward the new estimate").

**Convergence guarantee**: Q-learning converges to $Q^*$ if (1) every $(s,a)$ pair is visited **infinitely often**, and (2) the learning rate $\alpha$ is decreased appropriately (e.g. $\to 0$) over time. With a **constant** $\alpha$, Q-values may keep fluctuating and not settle. If you stop exploring ($\varepsilon \to 0$) before convergence, you generally will **not** learn optimal Q-values everywhere (you stop visiting some $(s,a)$ pairs).

**Approximate Q-Learning** (generalizes across states via features):

$$Q(s,a) = w_1 f_1(s,a) + w_2 f_2(s,a) + \cdots + w_n f_n(s,a)$$

$$\text{difference} = \left[ R(s,a,s') + \gamma \max_{a'} Q(s',a') \right] - Q(s,a)$$

$$w_i \leftarrow w_i + \alpha \cdot \text{difference} \cdot f_i(s,a)$$

* The magnitude of weight change is **proportional to the feature value** $f_i(s,a)$ — the feature with largest $\vert{}value\vert{}$ changes the most.
* Larger $\vert{}w_i\vert{}$ $\Rightarrow$ that feature dominates the action-preference direction (sign of weight tells you if higher feature value is good or bad).

### 5.4 Exploration vs. Exploitation

* **$\varepsilon$-greedy**: with probability $\varepsilon$ act randomly (explore), else take the argmax action (exploit). Simple but $\varepsilon$ must be manually decayed.
* **Exploration function**: $f(s,a) = Q(s,a) + \dfrac{k}{N(s,a)}$ — adds an optimism bonus for rarely-visited $(s,a)$; update rule becomes $Q(s,a) \leftarrow (1-\alpha)Q(s,a) + \alpha\left[R + \gamma \max_{a'} f(s',a')\right]$. Bonus fades automatically as $N$ grows, no manual $\varepsilon$ schedule needed.
* **Regret**: total reward lost versus always acting optimally from the start (a way to score learning algorithms, not just their final policy).

### 5.5 Quick sanity checks (common exam angles)

* Approximate Q-learning: choosing between two Q-states differing in one feature, sign of that feature's weight tells you the preferred direction (positive weight $\Rightarrow$ prefer higher feature value; negative weight $\Rightarrow$ prefer lower).
* Weighted-average variants of TD updates: weighting by "highest return gets weight 1, rest get weight 0" $\Rightarrow$ update **equals** using only the single highest-return sample (ignore the rest).
* A batch update that over-weights high-return samples (weights not uniform, decreasing with rank) produces **biased-high** value estimates relative to the true sample average.

## 6. Bayes Nets

### 6.1 Probability Basics

* Product/chain rule: $P(A,B) = P(A\mid B)P(B) = P(B\mid A)P(A)$; general: $P(A_1,\ldots,A_k) = \prod_{i=1}^{k} P(A_i \mid A_1 \ldots A_{i-1})$.
* Bayes' Rule: $P(A \mid B) = \dfrac{P(B \mid A)P(A)}{P(B)}$.
* Marginalization ("summing out"): $P(A) = \sum_{b} P(A, B=b)$.
* **Inference by Enumeration**: (1) select rows matching evidence, (2) sum out hidden variables, (3) normalize.

### 6.2 Bayes Net Structure

* DAG + one CPT per node: $P(X_i \mid \text{Parents}(X_i))$.
* Joint distribution factorization: $P(X_1,\ldots,X_n) = \prod_{i=1}^{n} P(X_i \mid \text{Parents}(X_i))$.
* **CPT size**: $(\text{domain size})^{(\#\text{parents}+1)}$ entries (e.g., 3 ternary parents feeding one ternary node → $3^3 = 27$ entries — parents' own values aren't included, just the count of conditioning variables + itself).
* Edges do **not** necessarily imply causation — just possible dependence.

### 6.3 Independence from Structure

* Each node is conditionally independent of its **non-descendants** given its **parents**.
* Each node is conditionally independent of everything else given its **Markov blanket** (parents + children + children's other parents).

### 6.4 D-Separation — the three canonical triples

| Configuration | Unobserved middle | Observed middle |
| --- | --- | --- |
| **Causal chain** $X \to Y \to Z$ | Active (dependent) | **Inactive** ($X \perp Z \mid Y$) |
| **Common cause** $X \leftarrow Y \to Z$ | Active | **Inactive** ($X \perp Z \mid Y$) |
| **Common effect** $X \to Y \leftarrow Z$ | **Inactive** ($X \perp Z$) | Active (dependent) — also active if any **descendant** of $Y$ is observed! |

**Algorithm**: to test $X \perp Y \mid \{Z_1,\ldots,Z_k\}$:

1. Shade all observed nodes.
2. Enumerate every undirected path between $X$ and $Y$; decompose into consecutive triples.
3. A path is **active** if all its triples are active; it "d-connects" $X$ and $Y$.
4. If **no** active path exists, $X$ and $Y$ are guaranteed conditionally independent given the evidence. If even one active path exists, independence is **not guaranteed**.

### 6.5 Exact Inference

* **Variable elimination**: join factors involving a hidden variable, then sum it out; repeat one variable at a time. Much cheaper than forming the full joint (avoids exponential blow-up) as long as intermediate factors stay small.
* Combining two variables into one joint variable in the graph: new CPT sizes = (product of combined domains) × (parents/children domains) — compute entry counts before/after to see net change.

### 6.6 Approximate Inference (Sampling)

* **Prior sampling**: simulate the whole net top-down via each CPT; unbiased but wasteful if querying rare evidence (must discard samples not matching evidence).
* **Rejection sampling**: reject early as soon as a sampled variable contradicts evidence (saves time vs. prior sampling but still discards samples).
* **Likelihood weighting**: fix evidence variables to their observed values (never rejects), and **weight** each sample by $\prod_i P(e_i \mid \text{Parents}(e_i))$ — ensures every CPT still contributes.
* **Gibbs sampling**: initialize all variables randomly, then repeatedly resample **one variable at a time** conditioned on the current values of all others (using only its Markov blanket); converges to the true posterior over many iterations even starting from a low-probability state.

## 7. Exam Pattern-Recognition Cheatsheet

* **"Select all that are admissible"**: check $h(n) \le h^*(n)$ at the *worst case* configuration — try extreme/edge assignments (e.g., all distances equal, one huge one small) to find counterexamples.
* **"Which search finds the lowest-cost/shallowest solution"**: uniform per-step cost $\Rightarrow$ BFS = UCS = iterative deepening all work; non-uniform costs $\Rightarrow$ only UCS (or A* with consistent $h$) guaranteed optimal.
* **Branching factor questions**: count max actions from *any* single state, express asymptotically (e.g., "any pair" $\Rightarrow O(s^2)$, not $O(s)$).
* **CSP arc-consistency "what remains after enforcing $X \to Y$"**: only prune values from the **tail** ($X$) that have zero support in $Y$'s current domain; don't touch $Y$'s domain from a $X \to Y$ arc.
* **Minimax/alpha-beta pruning "which nodes are not visited"**: trace left-to-right, prune a subtree exactly when the current bound at an ancestor already guarantees that subtree cannot change the final decision.
* **Value iteration "first nonzero at depth k"**: nonzero rewards propagate outward one graph-hop per VI iteration — trace shortest-path-in-hops from a reward-yielding transition to the queried state.
* **MDP/RL question mentioning "must remember whether X happened before"**: signals a **Markov property violation** — the fix is always to augment the state representation, not change the algorithm.
* **D-separation shortcut**: common-effect (collider) structures are the only ones that *flip* behavior (blocked when unobserved, active when observed or a descendant is observed) — everything else (chains, common cause) is blocked once observed.
