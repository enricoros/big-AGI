export { omit };

function omit(obj, key) {
    const { [key]: omitted, ...rest } = obj;
    return rest;
}