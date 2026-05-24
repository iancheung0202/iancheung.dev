#### **Logic & Equivalences**
* $\neg p = \text{not } p \quad p \wedge q = p \text{ and } q \quad p \vee q = p \text{ or } q \quad p \rightarrow q = \text{if } p, \text{ then } q \quad p \leftrightarrow q = p \text{ if and only if } q\qquad$ **Tautology:** always true $\qquad$ **Contradiction:** always false$\qquad$**Contingency:** it depends

| **Identity**     | $p \wedge T \equiv p$, $p \vee F \equiv p$                | **Domination**      | $p \vee T \equiv T$, $p \wedge F \equiv F$                  | **De Morgan's**             | $\neg(p \wedge q) \equiv \neg p \vee \neg q$     | **De Morgan's**         | $\neg(p \vee q) \equiv \neg p \wedge \neg q$                                                |
| :--------------- | :-------------------------------------------------------- | :------------------ | :---------------------------------------------------------- | :-------------------------- | :----------------------------------------------- | :---------------------- | :------------------------------------------------------------------------------------------ |
| **Idempotent**   | $p \vee p \equiv p$, $p \wedge p \equiv p$                | **Double Negation** | $\neg(\neg p) \equiv p$                                     | **Absorption**              | $p \vee (p \wedge q) \equiv p$                   | **Absorption**          | $p \wedge (p \vee q) \equiv p$                                                              |
| **Commutative**  | $p \vee q \equiv q \vee p$                                | **Commutative**     | $p \wedge q \equiv q \wedge p$                              | **Negation**                | $p \vee \neg p \equiv T$                         | **Negation**            | $p \wedge \neg p \equiv F$                                                                  |
| **Associative**  | $(p \vee q) \vee r \equiv p \vee (q \vee r)$              | **Associative**     | $(p \wedge q) \wedge r \equiv p \wedge (q \wedge r)$        | **Quantifiers**             | $\neg \forall x P(x) \equiv \exists x \neg P(x)$ | **Quantifiers**         | $\neg \exists x P(x) \equiv \forall x \neg P(x)$                                            |
| **Distributive** | $p \vee (q \wedge r) \equiv (p \vee q) \wedge (p \vee r)$ | **Distributive**    | $p \wedge (q \vee r) \equiv (p \wedge q) \vee (p \wedge r)$ | **Negation of Implication** | $\neg(A \to B) \equiv A \wedge \neg B$           | **Quantifier Negation** | $\neg (\forall x P(x) \to \exists x Q(x)) \equiv \forall x P(x) \wedge \forall x \neg Q(x)$ |
#### **Sets**
* **Subset:** $A \subseteq B \iff \forall x (x \in A \to x \in B)$ $\qquad$  **Equality:** $A = B \iff A \subseteq B \wedge B \subseteq A$$\qquad$ **Power Set:** $\mathcal{P}(S) = \{A \mid A \subseteq S\}$. Cardinality $|\mathcal{P}(S)| = 2^{|S|}$$\qquad$  **Cartesian Product:** $A \times B = \{(a,b) \mid a \in A, b \in B\}$
* **Set Difference:** $A \setminus B = \{x \in A \mid x \notin B\}$$\qquad$  **Russell's Paradox variation:** Let $A = \{s \in S \mid s \notin f(s)\}$. Then $A$ is not in the image of $f: S \to \mathcal{P}(S)$.
#### **Functions**
* **Injective (One-to-One):** $\forall a,b \in X, f(a) = f(b) \implies a = b$.$\qquad$  **Surjective (Onto):** $\forall y \in Y, \exists x \in X$ such that $f(x) = y$.$\qquad$ **Bijective:** Both injective and surjective (invertible). 
* **Floor/Ceiling:** $\lfloor x \rfloor$ is max integer $\le x$; $\lceil x \rceil$ is min integer $\ge x$.$\qquad$**Composition:** $(f \circ g)(x) = f(g(x))$. If $f \circ g$ surjective $\implies f$ surjective. If $f \circ g$ injective $\implies g$ injective.
#### **Cardinality**
* **Countable Sets:** A set $S$ is countable if $|S| \le |\mathbb{Z}^+|$ (it is finite or can be listed in a sequence). Examples: $\mathbb{Z}, \mathbb{Q}$.$\qquad$ **Uncountable Sets:** A set is uncountable if it is not countable. Example: $\mathbb{R}$.
* **Schröder-Bernstein Theorem:** If $|A| \le |B|$ and $|B| \le |A|$, then $|A| = |B|$.
#### **Number Theory**
* **Divisibility:** $a \mid b \iff b = ka$ for some $k \in \mathbb{Z}$.$\qquad$  **Linear Combination:** If $a \mid b$ and $a \mid c \implies a \mid (mb + nc)$.$\qquad$ **Euclidean Algorithm:** $\gcd(a, b) = \gcd(b, a \pmod b)$.
* **LCM/GCD:** $\gcd(a, b) \times \text{lcm}(a, b) = |ab|$.$\qquad$ **Bezout’s Theorem:** $\exists r, s \in \mathbb{Z}$ such that $r \cdot a + s \cdot b = \gcd(a, b)$.$\qquad$  **Fundamental Theorem of Arithmetic:** Every integer $>1$ is unique product of primes.
* Given $1 = ra+sb$, if $x \equiv c \pmod a$ and $x \equiv d \pmod b$, then $x=csb+dra$
#### **Modular Arithmetic**
* **Congruence:** $a \equiv b \pmod m \iff m \mid (a - b)$.$\qquad$  **Modular Inverse:** $a^{-1} \pmod m$ exists iff $\gcd(a, m) = 1$.$\qquad$ **Fermat's Little Theorem:** If $p$ prime and $p \nmid a$, then $a^{p-1} \equiv 1 \pmod p$. 
* **Chinese Remainder Theorem:** $x \equiv a_i \pmod{m_i}$ (coprime $m_i$).
	* $x = \sum a_i M_i y_i \pmod M$ where $M = \prod m_i$, $M_i = M/m_i$, $y_i = M_i^{-1} \pmod{m_i}$.
* **Divisibility Proofs (FLT Application):** *Problem:* Show $42 \mid (n^7 - n)$ by showing divisibility by factors of 42 ($2, 3, 7$) individually.
	* Mod 7: $n^7 \equiv n \pmod 7$ (FLT). $\qquad$ Mod 3: $n^7 = (n^3)^2 \cdot n \equiv n^2 \cdot n = n^3 \equiv n \pmod 3$ $\qquad$ Mod 2: $n^7 \equiv n \pmod 2$.
#### **Cryptography**
* **Public key:** $e$ and $n=pq$ ($p$ and $q$ are secret) $\qquad$ **Private key:** $d$.  $\qquad$ $\phi(n)=(p-q)(q-1) \qquad d \cdot e \equiv 1\pmod{\phi(n)}$
* **Alice Signs**: $S \equiv M^{d_A} \pmod{n_A}$. Uses **Alice's Private Key** ($d_A$).$\qquad$ **Alice Encrypts:** $C \equiv S^{e_B} \pmod{n_B}$. (Alice sends $C$). Uses **Bob's Public Key** ($e_B$).
* **Bob Decrypts**: $S \equiv C^{d_B} \pmod{n_B}$. Uses **Bob's Private Key** ($d_B$).$\qquad$ **Bob Verifies**: $M \equiv S^{e_A} \pmod{n_A}$. Uses **Alice's Public Key** ($e_A$).
### **Mathematical Induction** & Recursion
* **Induction:** Prove $P(1)$ is true. **Inductive Step:** Assume $P(k)$ is true (Inductive Hypothesis). Show $P(k) \implies P(k+1)$.
* **Strong Induction:** Prove $P(1)$ (and potentially $P(2)...$ as needed). **Inductive Step:** Assume $P(1) \wedge P(2) \wedge \dots \wedge P(k)$ are true. Show this implies $P(k+1)$.
* **Fibonacci Sequence:** $f_0 = 0, f_1 = 1, f_n = f_{n-1} + f_{n-2}$. Property (Cassini's Identity variation): $f_{n+1}f_{n-1} - f_n^2 = (-1)^n$.
* **Structural Induction:** Show property holds for initial elements. **Recursive Step:** Show if property holds for elements used to construct new element $x$, it holds for $x$.
### **Combinatorics**
* **Permutations:** $P(n, r) = \frac{n!}{(n-r)!}$. $\qquad$ **Combinations:** $C(n, r) = \binom{n}{r} = \frac{n!}{r!(n-r)!}$.$\qquad$ **Permutations with Repetition:** $n$ objects of $k$ types ($n_1, \dots, n_k$ alike):  $\frac{n!}{n_1! n_2! \dots n_k!}$
* **Inclusion-Exclusion:** 2 Sets: $|A \cup B| = |A| + |B| - |A \cap B|$. 3 Sets: $|A \cup B \cup C| = |A| + |B| + |C| - (|A \cap B| + |A \cap C| + |B \cap C|) + |A \cap B \cap C|$ 
* **Distinguishable Objects:** Placing $n$ distinguishable items into $k$ distinguishable boxes: $k^n$. $\qquad \binom{-n}{r}=(-1)^r \binom{n+r-1}{r}$
* **Binomial Theorem:** $(x+y)^n = \sum_{k=0}^n \binom{n}{k} x^{n-k}y^k$.$\qquad$ $\sum \binom{n}{k} = 2^n \qquad\sum (-1)^k \binom{n}{k} = 0$.
* **Stars and Bars:** Solutions to $x_1 + \dots + x_r = n, x_i \ge 0$: $\binom{n+r-1}{r-1}$  $\qquad$ Solutions to $x_1 + \dots + x_n = k$, $x_i \ge b$:  $\binom{k - nb + n - 1}{n - 1}$
* **Pascal's Identity:** $\binom{n+1}{k} = \binom{n}{k-1} + \binom{n}{k}$ (*Combinatorial Proof)
	* *Goal:* Choose a subset of $k$ elements from a set $S$ of $n+1$ elements. *Method 1:* Directly choose $k$ items from $n+1$: $\binom{n+1}{k}$. *Method 2:* Distinguish a specific element $x \in S$. **Case 1 ($x$ is in the subset):** We need to choose $k-1$ more elements from the remaining $n$ $\to \binom{n}{k-1}$. **Case 2 ($x$ is NOT in the subset):** We need to choose all $k$ elements from the remaining $n$ $\to \binom{n}{k}$. *Conclusion:* Total ways = Case 1 + Case 2.
* **Basic Pigeonhole Principle:** If $k+1$ objects placed in $k$ boxes, $\exists$ box with $\ge 2$ objects.$\qquad$ **Generalized:** If $N$ objects placed in $k$ boxes, $\exists$ box with $\ge \lceil N/k \rceil$ objects.
* **Ramsey Theory:** Example: In group of 6, $\exists$ 3 mutual friends or 3 mutual strangers ($K_6 \to K_3 \text{ or } \bar{K_3}$).
### **Probability**
* **Probability of Event:** $P(E) = \frac{|E|}{|S|}$ (uniform sample space). $\qquad$ **Conditional Probability:** $P(A \mid B) = \frac{P(A \cap B)}{P(B)}$.$\qquad$ **Independence:** $A, B$ independent $\iff P(A \cap B) = P(A)P(B)$. 
* **Bayes' Theorem:** $P(F \mid E) = \frac{P(E \mid F)P(F)}{P(E \mid F)P(F) + P(E \mid \bar{F})P(\bar{F})}$$\qquad$ **Bernoulli Trials:** Prob. of exactly $k$ successes in $n$ trials (prob $p$): $P(X=k) = \binom{n}{k} p^k (1-p)^{n-k}$
* **Expected Value:** $E(X) = \sum x \cdot P(X=x)$.$\qquad$ **Binomial:** $E(X) = np$ $\qquad$ **Geometric (Wait for 1st success):** $E(X) = 1/p$.$\qquad$ **Linearity:** $E(X+Y) = E(X) + E(Y)$.
* **Variance:** $V(X) = E(X^2) - [E(X)]^2 = \sum V(x)$ $\qquad$ **Binomial Variance:** $\sigma^2 = np(1-p)$.
* **Chebyshev's Inequality:** $P(|X - \mu| \ge r) \le \frac{V(X)}{r^2}$ $\quad$ or $\quad$ $P(|X - \mu| \ge k\sigma) \le \frac{1}{k^2}$.
### **Graph Theory**
* **Handshaking Theorem:** $2|E| = \sum_{v \in V} \deg(v)$. Corollary: Number of vertices with odd degree must be even. $\qquad$**Euler's Formula:** $v - e + r = 2$ (where $r$ is regions/faces).
    * **Complete ($K_n$):** All vertices connected. Deg $= n-1$. Size $m = \binom{n}{2}$. $\qquad$ **Cycle ($C_n$):** $n \ge 3$, deg 2 everywhere.$\qquad$ **Cube ($Q_n$):** $2^n$ vertices.
    * **Wheel ($W_n$):** $C_n$ + center hub. $n+1$ vertices.$\qquad$**Bipartite:** Vertices split into disjoint sets $V_1, V_2$ with no internal edges. ($C_n$ is bipartite iff $n$ is even).
* **Isomorphism:** Graphs $G, H$ isomorphic if bijection $f: V_G \to V_H$ preserves adjacency. 
* **Euler Circuit:** Uses every edge once, returns to start. Exists $\iff$ all $\deg(v)$ are even.$\qquad$ **Euler Path:** Uses every edge once. Exists $\iff$ exactly 0 or 2 vertices have odd degree.
* **Planar Graphs:** Can be drawn without edge crossings. $\qquad$ **Kuratowski's Theorem:** Non-planar $\iff$ contains subdivision of $K_5$ or $K_{3,3}$.
* **Chromatic Number ($\chi(G)$):** Min colors so no adjacent vertices share color.$\qquad$ **Four Color Theorem:** If planar, $\chi(G) \le 4$.

