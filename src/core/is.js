export const is = {
    obj: (a) => a === Object(a) && !is.arr(a) && typeof a !== 'function',
    fun: (a) => typeof a === 'function',
    str: (a) => typeof a === 'string',
    num: (a) => typeof a === 'number',
    und: (a) => a === void 0,
    arr: (a) => Array.isArray(a),
    equ(a, b) {
        // Wrong type or one of the two undefined, doesn't match
        if (typeof a !== typeof b || !!a !== !!b)
            return false;
        // Atomic, just compare a against b
        if (is.str(a) || is.num(a) || is.obj(a))
            return a === b;
        // Array, shallow compare first to see if it's a match
        if (is.arr(a) && a == b)
            return true;
        // Last resort, go through keys
        let i;
        for (i in a)
            if (!(i in b))
                return false;
        for (i in b)
            if (a[i] !== b[i])
                return false;
        return is.und(i) ? a === b : true;
    },
};
