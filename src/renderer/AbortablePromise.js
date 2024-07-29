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
            this.promise
                .then(onResolve)
                .then(resolve)
                .catch(reject);
        }, this.abortHandler);
    }

    catch(onFail) {
        return new AbortablePromise((resolve, reject) => {
            this.promise
                .then(resolve)
                .catch(onFail)
                .catch(reject);
        }, this.abortHandler);
    }

    abort(reason) {
        if (this.abortHandler) {
            this.abortHandler(reason);
        }
    }
}

export class AbortedPromiseError extends Error {}
