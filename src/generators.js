export function* fill(n, value) {
    for (let i = 0; i < n; i++) {
        yield value;
    }
}
