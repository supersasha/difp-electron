//console.log('CWD:', process.cwd());

const { loadRaw } = require('bindings')({
    module_root: process.cwd(), //'/home/supersasha/devel/personal/proba/react-electron',
    bindings: 'raw.node',
});//('../build/Release/raw.node');
//module.exports = { loadRaw };

export { loadRaw };
