export function initUniform(gl, program, struct, path) {
    if (Array.isArray(struct)) {
        const innerArray = path[path.length-1] === ']';
        for (let i = 0; i < struct.length; i++) {
            initUniform(gl, program, struct[i], `${path}${innerArray ? '.a' : ''}[${i}]`);
        }
    } else if (typeof struct === 'object' && struct !== null) {
        for (let key of Object.keys(struct)) {
            initUniform(gl, program, struct[key], `${path}.${key}`);
        }
    } else if (typeof struct === 'boolean') {
        const loc = gl.getUniformLocation(program, path);
        if (!loc) {
            console.error(`Can't locate uniform at ${path}`);
        }
        gl.uniform1i(loc, struct ? 1 : 0);
    } else if (typeof struct === 'string' && struct[0] === '#') {
        const loc = gl.getUniformLocation(program, path);
        if (!loc) {
            console.error(`Can't locate uniform at ${path}`);
        }
        gl.uniform1i(loc, parseInt(struct.slice(1)));
    } else if (typeof struct === 'number') {
        const loc = gl.getUniformLocation(program, path);
        if (!loc) {
            console.error(`Can't locate uniform at ${path}`);
        }
        gl.uniform1f(loc, struct);
    }
}
