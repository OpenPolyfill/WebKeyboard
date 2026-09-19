/** Small WebIDL helpers shared by page-facing facades. */
"use strict";

/** Throws the WebIDL illegal-constructor error. */
function illegalConstructor() {
  throw pageTypeError("Illegal constructor");
}

/** Throws the WebIDL illegal-invocation error. */
function illegalInvocation() {
  throw pageTypeError("Illegal invocation");
}

const convertDOMStringSequence = (() => {
  /** Converts one value using DOMString-compatible coercion. */
  function toDOMString(value) {
    value = unwrap(value);
    if (typeof value === "symbol") {
      throw pageTypeError("Cannot convert a Symbol value to a string");
    }
    return String(value);
  }

  /** Converts an iterable to a sequence of DOMStrings. */
  function convertDOMStringSequence(value) {
    if (value === undefined) return [];

    const source = unwrap(value);
    if (
      source === null ||
      (typeof source !== "object" && typeof source !== "function")
    ) {
      throw pageTypeError("keyCodes is not an object");
    }

    const iteratorMethod = source[Symbol.iterator];
    if (typeof iteratorMethod !== "function") {
      throw pageTypeError("keyCodes is not iterable");
    }

    const iterator = Reflect.apply(iteratorMethod, source, []);
    if (
      iterator === null ||
      (typeof iterator !== "object" && typeof iterator !== "function")
    ) {
      throw pageTypeError("iterator is not an object");
    }

    const next = iterator.next;
    if (typeof next !== "function") {
      throw pageTypeError("iterator.next is not callable");
    }

    const result = [];
    for (;;) {
      const step = Reflect.apply(next, iterator, []);
      if (step === null || typeof step !== "object") {
        throw pageTypeError("iterator result is not an object");
      }

      if (step.done) return result;
      result.push(toDOMString(step.value));
    }
  }

  return convertDOMStringSequence;
})();

/** Validates a receiver using a native getter. */
function requireNativeGetterReceiver(value, getter) {
  if (typeof getter !== "function") illegalInvocation();

  try {
    Reflect.apply(getter, value, []);
  } catch {
    illegalInvocation();
  }

  return unwrap(value);
}

/** Resolves an EventTarget-backed WebIDL receiver across isolated realms. */
function resolveEventTargetReceiver(
  value,
  brand,
  interfaceName,
  methodName,
  currentMethod,
) {
  const receiver = unwrap(value);
  if (brand.has(receiver)) return { receiver, method: null };

  if (
    receiver === null ||
    (typeof receiver !== "object" && typeof receiver !== "function")
  ) {
    illegalInvocation();
  }

  try {
    Reflect.apply(window.EventTarget.prototype.removeEventListener, receiver, [
      "",
      null,
    ]);
  } catch {
    illegalInvocation();
  }

  const prototype = Reflect.getPrototypeOf(receiver);
  if (!prototype) illegalInvocation();

  const tag = Reflect.getOwnPropertyDescriptor(
    prototype,
    Symbol.toStringTag,
  )?.value;
  const constructor = Reflect.getOwnPropertyDescriptor(
    prototype,
    "constructor",
  )?.value;
  const method = Reflect.get(prototype, methodName, receiver);

  if (
    tag !== interfaceName ||
    typeof constructor !== "function" ||
    unwrap(constructor.prototype) !== prototype ||
    typeof method !== "function" ||
    unwrap(method) === unwrap(currentMethod)
  ) {
    illegalInvocation();
  }

  return { receiver, method };
}
