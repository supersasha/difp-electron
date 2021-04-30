const { loadRaw } = require('bindings')({
    module_root: process.cwd(),
    bindings: 'raw.node',
});

export { loadRaw };
