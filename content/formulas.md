---
title: Formula Examples
summary: LaTeX-style inline and display formulas rendered with KaTeX.
eyebrow: Wiki guide
status: reference
---

Use LaTeX math syntax between dollar-sign delimiters. KaTeX renders formulas locally in the browser without a build step.

## Inline formulas

Use one dollar sign on each side for a formula within prose:

```md
Damage scales as $D = B\left(1 + \frac{L}{10}\right)$.
```

Damage scales as $D = B\left(1 + \frac{L}{10}\right)$.

## Display formulas

Put double-dollar delimiters on their own lines for a standalone formula:

```md
$$
P(\text{critical}) = \min\left(1, \frac{C}{100}\right)
$$
```

$$
P(\text{critical}) = \min\left(1, \frac{C}{100}\right)
$$

## Curves and falloff

```md
$$
I(d) = I_0 e^{-\lambda d}
$$
```

$$
I(d) = I_0 e^{-\lambda d}
$$

## Weighted outcomes

```md
$$
P(i) = \frac{w_i}{\sum_{j=1}^{n} w_j}
$$
```

$$
P(i) = \frac{w_i}{\sum_{j=1}^{n} w_j}
$$

## Piecewise rules

```md
$$
f(x) =
\begin{cases}
0 & x < 0 \\
2x & 0 \le x < 10 \\
20 & x \ge 10
\end{cases}
$$
```

$$
f(x) =
\begin{cases}
0 & x < 0 \\
2x & 0 \le x < 10 \\
20 & x \ge 10
\end{cases}
$$

## Authoring rules

- Inline math uses `$...$`.
- Display math uses `$$` delimiters on separate lines.
- Keep formulas outside code fences when they should render.
- Put formulas inside a `md` code fence when demonstrating their source.
- Invalid or unsupported formulas fail visibly so documentation errors are not hidden.

See the [KaTeX supported-functions reference](https://katex.org/docs/supported.html) for available commands.
