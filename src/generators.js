export function* fill(n, value) {
    for (let i = 0; i < n; i++) {
        yield value;
    }
}

export function *linspace(from, to, steps) {
    if (steps < 2) {
        return;
    }
    const d = (to - from) / (steps - 1);
    for (let i = 0; i < steps; i++) {
        yield from + d * i;
    }
}
