## Core Syntax

```scheme
(<operator> <operand1> <operand2> ...)
````

Everything is a call unless noted as a special form.

---
## Special Forms

### define (variables + named procedures)

```scheme
(define x 10) ; variable
(define (square x) (* x x)) ; procedure
```
### lambda (anonymous functions)

```scheme
(lambda (x y) (+ x y))
```
### if (single condition)

```scheme
(if <predicate> <then> <else>)
```

### cond (multiple branches)

```scheme
(cond
	[(p1) e1]
	[(p2) e2]
	[else e3])
```
### let (local bindings)

```scheme
(let ((x 3) (y 4))
	(+ x y))
```
### quote (literal data)

```scheme
(quote (1 2 3)) ; same as '(1 2 3)
```
### begin (evaluate in sequence)

```scheme
(begin expr1 expr2 ...)
```

---
## Booleans & Predicates

```scheme
#t #f
(not x)
(and x y)
(or x y)
(boolean? x)
```

Comparison:
```scheme
(= x y)
(< x y)
(> x y)
(<= x y)
(>= x y)
```

---
## Numbers & Arithmetic

```scheme
(+ x y) (- x y) (* x y) (/ x y)
(quotient a b) (remainder a b)
(number? x) (integer? x)
```

---
## Lists

### Constructing

```scheme
(list 1 2 3)
'(1 2 3)
(cons x lst) ; add x to front of list
```
### Accessing

```scheme
(car lst) ; first element
(cdr lst) ; rest of list
(null? lst) ; empty list?
(pair? x)
```

Convenience:

```scheme
(cadr lst) ; 2nd element
(caddr lst) ; 3rd element
```

### Typical recursive pattern

```scheme
(define (length lst)
	(if (null? lst)
		0
		(+ 1 (length (cdr lst)))))
```

---
## Trees

```scheme
(define (tree? t) (pair? t))
(define (tree-map fn t)
	(if (not (pair? t))
		(fn t)
		(cons (tree-map fn (car t))
			  (tree-map fn (cdr t)))))
```

---
## Higher-Order Functions

### Passing functions

```scheme
((lambda (x) (* x x)) 5)
```
### Function builders

```scheme
(define (make-adder n)
(lambda (x) (+ x n)))
```

Map / Filter / Reduce style

```scheme
(map fn lst) ; (map (lambda (x) (* x x)) '(1 2 3 4)) --> '(1 4 9 16)
(filter pred lst) ; (filter even? '(1 2 3 4)) --> '(2 4)
(foldl fn base lst) 
; (foldl + 0 '(1 2 3 4)) --> 10 (+ 1 (+ 2 (+ 3 (+ 4 0))))
; (+ (+ (+ (+ (+ (+ 0 1) 2) 3) 4) 5) 6)
(foldr fn base lst) 
; (foldr + 0 '(1 2 3 4)) => 10
; (+ 1 (+ 2 (+ 3 (+ 4 0))))
```

---
## Recursion Patterns

### List recursion

```scheme
(if (null? lst) <base> <recur on (cdr lst)>)
```
### Tree recursion

```scheme
(if (leaf?) <base>
	(combine (recur left) (recur right)))
```
### Accumulate pattern (general recursion)

```scheme
(define (accumulate combiner base lst)
	(if (null? lst)
		base
		(combiner (car lst)
			(accumulate combiner base (cdr lst)))))
```

---
## Mutation

```scheme
(set! var expr) ; reassign variable
(set-car! pair expr)
(set-cdr! pair expr)
```

---
## Equivalence

```scheme
(eq? x y) ; same object?
(equal? x y) ; same structure/value?
```

---
## Printing / I/O in interpreter

```scheme
(display expr)
(newline)
```

---
## Evaluation Rule

**Evaluation of a call:**
1. Evaluate operator
2. Evaluate operands left-to-right
3. Apply operator to evaluated operands

**Special forms** change the above rules (e.g., `if` only evaluates one branch).

---
## Lambda Box Model (mental model)

* Every function call creates a new **frame**
* Parameters are bound to arguments inside frame
* Lookup: **Local → Parent → Global**

---
## Quick Rules

* Lists are built from nested `cons` pairs
* `null` is only true empty list
* `cond` must end with `else`
* Avoid mutation unless problem specifically wants it
* Keep recursion base case first & simplest