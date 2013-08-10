var T = require('./ristretto').T;

T.assertType = function assertType(o, typeName, validator) {
    T('whatever :: ' + typeName + ' -> Unit', function (w) {})(o);
    if (validator && !validator(o)) throw new Error('Failed on validator');
}

module.exports = T;
