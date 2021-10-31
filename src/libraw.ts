import bindings from 'bindings';
const { loadRaw } = bindings({
    module_root: process.cwd(),
    bindings: 'raw.node',
});

export { loadRaw };
