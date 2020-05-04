export const extensionAction = opes => {
    return _ => next => action => {
        if(typeof opes === 'function') action = opes(action)
        next(action)
    }
}