/** Firefox Xray helpers for page-realm WebIDL surfaces. */
"use strict";

const {
  unwrap,
  exportToPage,
  definePageProperty,
  setPagePrototype,
  pageTypeError,
  pagePromise,
  rejectedPagePromise,
} = (() => {
  const PagePromise = window.Promise;
  const PageDOMException = window.DOMException;
  const PageError = window.Error;
  const PageTypeError = window.TypeError;

  /**
   * Returns the raw object behind a Firefox wrapper when available.
   * @param {*} value Value to unwrap.
   * @returns {*} Unwrapped value.
   */
  function unwrap(value) {
    if (
      value === null ||
      (typeof value !== "object" && typeof value !== "function")
    ) {
      return value;
    }

    return value.wrappedJSObject ?? value;
  }

  /**
   * Exports an isolated function into the page realm.
   * @param {Function} fn Function to export.
   * @param {object} target Export target realm object.
   * @returns {Function} Page-realm callable.
   */
  function exportToPage(fn, target = window) {
    return unwrap(exportFunction(fn, target));
  }

  /**
   * Defines a property on a page-realm target.
   * @param {object} target Target object.
   * @param {PropertyKey} key Property key.
   * @param {PropertyDescriptor} descriptor Property descriptor.
   */
  function definePageProperty(target, key, descriptor) {
    if (!Reflect.defineProperty(unwrap(target), key, descriptor)) {
      throw new Error(`WebKeyboard could not define ${String(key)}`);
    }
  }

  /**
   * Sets the prototype of a page-realm object.
   * @param {object} target Target object.
   * @param {object|null} prototype Prototype object.
   */
  function setPagePrototype(target, prototype) {
    if (!Reflect.setPrototypeOf(unwrap(target), unwrap(prototype))) {
      throw new Error("WebKeyboard could not set page prototype");
    }
  }

  /**
   * Creates a page-realm TypeError.
   * @param {string} message Error message.
   * @returns {TypeError} Page-realm error.
   */
  function pageTypeError(message) {
    return new PageTypeError(message);
  }

  /**
   * Converts a rejection value for the page realm.
   * @param {*} error Rejection value.
   * @returns {*} Page-visible rejection value.
   */
  function pageError(error) {
    const raw = unwrap(error);
    if (raw !== error) return raw;

    if (
      error === null ||
      (typeof error !== "object" && typeof error !== "function")
    ) {
      return error;
    }

    const name = typeof error?.name === "string" ? error.name : "Error";
    const message =
      typeof error?.message === "string"
        ? error.message
        : "WebKeyboard operation failed";

    if (name === "TypeError") return new PageTypeError(message);
    if (name === "Error") return new PageError(message);
    return new PageDOMException(message, name);
  }

  /**
   * Runs a task and exposes its result through a page-realm Promise.
   * @param {Function} task Task returning a value or promise.
   * @returns {Promise} Page-realm promise.
   */
  function pagePromise(task) {
    return new PagePromise((resolve, reject) => {
      Promise.resolve()
        .then(task)
        .then(resolve, (error) => reject(pageError(error)));
    });
  }

  /**
   * Creates a rejected page-realm Promise.
   * @param {*} error Rejection reason.
   * @returns {Promise} Rejected page-realm promise.
   */
  function rejectedPagePromise(error) {
    return new PagePromise((_, reject) => reject(pageError(error)));
  }

  return {
    unwrap,
    exportToPage,
    definePageProperty,
    setPagePrototype,
    pageTypeError,
    pagePromise,
    rejectedPagePromise,
  };
})();
