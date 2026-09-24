# CS 61A Textbook Summary for Midterm 2

## 1. Recursive Functions ([1.7](https://www.composingprograms.com/pages/17-recursive-functions.html))

### Structure

```python
def f(args):
    if base_condition(args):
        return base_value
    else:
        return combine(f(simpler_args), other computation)
```

### Examples

```python
def sum_digits(n):
    if n < 10:
        return n
    else:
        return sum_digits(n // 10) + n % 10

def fact(n):
    if n == 1:
        return 1
    else:
        return n * fact(n-1)
```

Mutual recursion:

```python
def is_even(n):
    if n == 0: return True
    return is_odd(n-1)

def is_odd(n):
    if n == 0: return False
    return is_even(n-1)
```

Tree recursion:

```python
def fib(n):
    if n == 1: return 0
    if n == 2: return 1
    return fib(n-1) + fib(n-2)

```

Counting partitions:

```python
def count_partitions(n, m):
    if n == 0: return 1
    if n < 0 or m == 0: return 0
    return count_partitions(n-m, m) + count_partitions(n, m-1)
```

### Notes

- Always have a **base case**.
- Avoid infinite recursion.
- Use **memoization** to optimize overlapping subproblems.
- `print` can trace recursive execution.

## 2. Introduction ([2.1](https://www.composingprograms.com/pages/21-introduction.html))

- Introduces structured program design:
  - Start from functions → data abstraction → OOP → efficiency.
- Focus on separating **what** (specification) from **how** (implementation).

## 3. Data Abstraction ([2.2](https://www.composingprograms.com/pages/22-data-abstraction.html))

### Core Idea

- Separate *interface* (what you can do) from *representation* (how it's done).

### Example: Rational Numbers

```python
def rational(n, d):
    g = gcd(n, d)
    return (n//g, d//g)

def numer(x): return x[0]
def denom(x): return x[1]

def add_rationals(x, y):
    return rational(numer(x)*denom(y) + numer(y)*denom(x),
                    denom(x)*denom(y))
```

### Functional Pair

```python
def pair(x, y):
    def get(i):
        if i == 0: return x
        if i == 1: return y
    return get

def select(p, i):
    return p(i)
```

### Rules

- Only access data via constructors/selectors.
- Changing representation shouldn't affect external code.
- Never cross the abstraction barrier.

## 4. Sequences ([2.3](https://www.composingprograms.com/pages/23-sequences.html))

### Syntax

```python
lst = [1, 2, 3]
lst[0]      # indexing
len(lst)    # length
lst + [4,5] # concatenation
lst * 2     # repetition
```

### Iteration

```python
for x in lst:
    print(x)

for i in range(len(lst)):
    print(lst[i])
```

### Unpacking

```python
pairs = [[1, 2], [3, 4]]
for x, y in pairs:
    print(x, y)
```

### Range

```python
list(range(5))        # [0,1,2,3,4]
list(range(2, 7))     # [2,3,4,5,6]
```

### Concept

- Treat sequences generically, not as lists specifically.

## 5. Mutable Data ([2.4](https://www.composingprograms.com/pages/24-mutable-data.html))

### Mutability

- Data that can change after creation.

### Lists

```python
lst = [1,2,3]
lst[1] = 5
lst.append(9)
lst.pop()
```

### Dictionaries

```python
d = {}
d['x'] = 10
print(d['x'])
del d['x']
```

### Nonlocal / Global

```python
def outer():
    x = 0
    def inner():
        nonlocal x
        x += 1
    inner()
    return x
```

### Notes

- Use mutation when needed; otherwise prefer immutability.
- Watch for side effects.
- Keep abstraction barriers.

## 6. Object-Oriented Programming ([2.5](https://www.composingprograms.com/pages/25-object-oriented-programming.html))

### Class Structure

```python
class ClassName:
    def __init__(self, x):
        self.x = x
    def method(self, y):
        return self.x + y

obj = ClassName(3)
print(obj.method(4))
```

### Inheritance

```python
class Animal:
    def speak(self): print("...")

class Dog(Animal):
    def speak(self):
        super().speak()
        print("Woof")
```

### Notes

- `self` = instance reference.
- Class attrs shared; instance attrs unique.
- Override methods for polymorphism.
- Prefer composition when inheritance isn't clear.

## 7. Object Abstraction ([2.7](https://www.composingprograms.com/pages/27-object-abstraction.html))

### Example

```python
class Rational:
    def __init__(self, n, d):
        g = gcd(n, d)
        self.numer = n // g
        self.denom = d // g

    def __repr__(self):
        return f"{self.numer}/{self.denom}"

    def __eq__(self, other):
        return self.numer * other.denom == other.numer * self.denom

    def __add__(self, other):
        return Rational(self.numer * other.denom + other.numer * self.denom,
                        self.denom * other.denom)
```

### Notes

- Use special methods (`__repr__`, `__eq__`, `__add__`, etc.) for behavior.
- Hide internal representation.
- Maintain consistent interface regardless of internals.

## 8. Efficiency ([2.8](https://www.composingprograms.com/pages/28-efficiency.html))

### Core Concepts

- **Time complexity**: growth rate vs input size.
- **Space complexity**: memory used.
- **Asymptotic notation**: Big-O, Θ, Ω.

### Memoization

```python
cache = {}
def fib(n):
    if n in cache: return cache[n]
    if n <= 2: result = n-1
    else: result = fib(n-1) + fib(n-2)
    cache[n] = result
    return result
```

### Fast Power

```python
def fast_pow(x, n):
    if n == 0: return 1
    if n % 2 == 0:
        y = fast_pow(x, n//2)
        return y * y
    return x * fast_pow(x, n-1)
```

### Notes

- Use caching to avoid recomputation.
- Choose algorithms with lower growth orders.
- Balance time vs space.

## 9. Implicit Sequences ([4.2](https://www.composingprograms.com/pages/42-implicit-sequences.html))

### Concept

- Infinite or lazy sequences — compute elements on demand.

### Example

```python
class Stream:
    def __init__(self, first, compute_rest):
        self.first = first
        self._compute_rest = compute_rest
        self._rest = None

    @property
    def rest(self):
        if self._rest is None:
            self._rest = self._compute_rest()
        return self._rest
```

### Notes

- Use `.first` and `.rest` to access.
- Avoid recomputation — cache results.
- Enables working with infinite data streams.
- Be mindful of recursion depth.

## 10. Recursion Deep Dive

### 10.1 Structure of Recursive Functions

```python
def func(args):
    if base_condition(args):
        return base_value               # base case
    smaller = simplify(args)
    return combine(func(smaller), args) # recursive case
```

- **Base case**: stops recursion, must be reached.
- **Recursive case**: must simplify input toward base.
- Each call creates a new **stack frame** with its own local variables.

### 10.2 Common Patterns

#### 1. Linear recursion

Processes one subproblem at a time.

```python
def sum_list(lst):
    if not lst:
        return 0
    return lst[0] + sum_list(lst[1:])
```

- Stack depth proportional to input size `n`.
- Common for list traversal and counting.

#### 2. Tree recursion

Multiple recursive calls per level.

```python
def fib(n):
    if n <= 1:
        return n
    return fib(n-1) + fib(n-2)
```

- Exponential growth in calls.
- Use memoization to reduce to O(n).

#### 3. Tail recursion (conceptual)

Recursive call is the last action.

```python
def factorial(n, acc=1):
    if n == 0:
        return acc
    return factorial(n-1, acc*n)
```

- Can be optimized into iteration (Python doesn't optimize tail calls).
- Useful when converting recursion to loops.

#### 4. Mutual recursion

Functions calling each other.

```python
def even(n):
    if n == 0: return True
    return odd(n-1)

def odd(n):
    if n == 0: return False
    return even(n-1)
```

- Used in alternating conditions (e.g. games, parity checks).

#### 5. Helper recursion

Encapsulate state or accumulator in a helper function.

```python
def reverse_list(lst):
    def helper(rest, acc):
        if not rest:
            return acc
        return helper(rest[1:], [rest[0]] + acc)
    return helper(lst, [])
```

- Reduces arguments in main call.
- Keeps clean external API.

### 10.3 Recursion on Structures

#### Lists

```python
def count_occurrences(lst, x):
    if not lst:
        return 0
    return (lst[0] == x) + count_occurrences(lst[1:], x)
```

#### Trees

```python
def tree_sum(t):
    if not t:
        return 0
    return t.label + sum(tree_sum(b) for b in t.branches)
```

#### Nested data

```python
def flatten(lst):
    if not lst:
        return []
    first, rest = lst[0], lst[1:]
    if isinstance(first, list):
        return flatten(first) + flatten(rest)
    return [first] + flatten(rest)
```

### 10.4 Optimization

#### Memoization

```python
cache = {}
def f(x):
    if x in cache: return cache[x]
    result = compute(x)
    cache[x] = result
    return result
```

#### Divide & Conquer

Split into halves to reduce recursion depth.

```python
def merge_sort(lst):
    if len(lst) <= 1:
        return lst
    mid = len(lst)//2
    left = merge_sort(lst[:mid])
    right = merge_sort(lst[mid:])
    return merge(left, right)
```
