export function* fill(n: number, value: number): Generator<number> {
    for (let i = 0; i < n; i++) {
        yield value;
    }
}

export function* linspace(from: number, to: number, steps: number): Generator<number> {
    if (steps < 2) {
        return;
    }
    const d = (to - from) / (steps - 1);
    for (let i = 0; i < steps; i++) {
        yield from + d * i;
    }
}
