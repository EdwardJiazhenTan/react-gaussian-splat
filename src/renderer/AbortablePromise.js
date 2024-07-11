export class AbortablePromise {
    static idGen = 0;

    constructor(promiseFunc, abortHandler) {
        let resolver;
        let rejecter;
        this.promise = new Promise((resolve, reject) => {
            resolver = resolve;
            rejecter = reject;
        });

        const promiseResolve = resolver.bind(this);
        const promiseReject = rejecter.bind(this);

        const resolve = (...args) => {
            promiseResolve(...args);
        };

        const reject = (error) => {
            promiseReject(error);
        };

        promiseFunc(resolve.bind(this), reject.bind(this));
        this.abortHandler = abortHandler;
        this.id = AbortablePromise.idGen++;
    }

    static reject(error) {
        return new AbortablePromise((resolve, reject) => {
            reject(error);
        });
    }

    then(onResolve) {
        return new AbortablePromise((resolve, reject) => {
            this.promise = this.promise
            .then((...args) => {
                const onResolveResult = onResolve(...args);
                if (onResolveResult instanceof Promise || onResolveResult instanceof AbortablePromise) {
                    onResolveResult.then((...args2) => {
                        resolve(...args2);
                    });
                } else {
                    resolve(onResolveResult);
                }
            })
            .catch((error) => {
                reject(error);
            });
        }, this.abortHandler);
    }

    catch(onFail) {
        return new AbortablePromise((resolve) => {
            this.promise = this.promise.then((...args) => {
                resolve(...args);
            })
            .catch(onFail);
        }, this.abortHandler);
    }

    abort() {
        if (this.abortHandler) this.abortHandler();
    }
}

export class AbortedPromiseError extends Error {}
