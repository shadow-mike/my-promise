
const STATE = {
  PENDING: 'pending',
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected',
}

const asyncFn = function() {
  if (process && typeof process.nextTick === 'function') return process.nextTick
  if (typeof setImmediate === 'function') return setImmediate
  return setTimeout
}()

function setPromiseState(promise, state, value) {
  promise.value = value
  promise.state = state
  promise.callbacks.forEach(cb => {
    handleCallback(promise, cb)
  })
  promise.callbacks = []
}

function resolve(promise, value) {
  if (promise.state !== STATE.PENDING) return
  if (promise === value) return reject(promise, new TypeError())

  // if value is a promise
  if (value && value instanceof MyPromise) {
    if (value.state === STATE.PENDING) {
      value.callbacks.push(...promise.callbacks)
    } else if (promise.callbacks.length) {
      promise.callbacks.forEach(cb => {
        handleCallback(value, cb)
      })
      value.callbacks = []
    }
    return
  }

  // if value is a thenable object
  if (typeof value === 'object' || typeof value === 'function') {
    try {
      var then = value.then
    } catch (error) {
      reject(promise, error)
    }
    if (typeof then === 'function') {
      try {
        then.call(value, v => resolve(promise, v), r => reject(promise, r))
      } catch (error) {
        reject(promise, error)
      }
    } else {
      setPromiseState(promise, STATE.FULFILLED, value)
    }
    return
  }

  // if value is primitive
  setPromiseState(promise, STATE.FULFILLED, value)

}

function reject(promise, reason) {
  if (promise.state !== STATE.PENDING) return
  setPromiseState(promise, STATE.REJECTED, reason)
}

function handleCallback(promise, callback) {
  asyncFn(function() {
    if (promise.state === STATE.PENDING) return
    const {onFulfilled, onRejected, promise: nextPromise} = callback
    const cb = {
      [STATE.FULFILLED]: onFulfilled,
      [STATE.REJECTED]: onRejected,
    }[promise.state]
    if (!cb) {
      const handleFn = {
        [STATE.FULFILLED]: resolve,
        [STATE.REJECTED]: reject,
      }[promise.state]
      handleFn(nextPromise, promise.value)
      return
    }
    try {
      var result = cb(promise.value)
    } catch (error) {
      reject(promise, error)
    }
    resolve(nextPromise, result)
  })
}

class MyPromise {
  constructor(fn) {

    this.state = STATE.PENDING
    this.callbacks = []
    this.value = null
    if (!fn || typeof fn !== 'function') {
      throw new TypeError(`Promise resolver ${fn} is not a function`)
    }
    try {
      fn(val => resolve(this, val), rsn => reject(this, rsn))
    }
    catch (error) {
      reject(error)
    }
  }

  then(onFulfilled, onRejected) {
    var newPromise = new MyPromise(function() {})
    const cb = {onFulfilled, onRejected, promise: newPromise}
    if (this.state === STATE.PENDING) {
      this.callbacks.push(cb)
    } else {
      handleCallback(this, cb)
    }
    return newPromise
  }

  static deferred() {
    let resolve, reject
    return {
      promise: new MyPromise((rslv, rjct) => {
        resolve = rslv
        reject = rjct
      }),
      resolve,
      reject,
    };
  }
}

module.exports = MyPromise