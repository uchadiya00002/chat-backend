// src/playground/event-loop.ts
//
// This file illustrates the exact execution order of the event loop.
// Run it and predict the output BEFORE you see it — if you get it right,
// you understand the event loop. If not, study the explanation below.

console.log('1 - synchronous, runs immediately');

setTimeout(() => {
  console.log('4 - macrotask (setTimeout), runs after microtasks clear');
}, 0);

Promise.resolve().then(() => {
  console.log('3 - microtask (Promise), runs before any macrotask');
});

console.log('2 - synchronous, still on the call stack');

// Output order: 1, 2, 3, 4
//
// The rule: after the current call stack empties, Node drains ALL
// microtasks (Promises) completely before picking up the next
// macrotask (setTimeout, setInterval, I/O callbacks).
// This is why Promise callbacks always run before setTimeout(fn, 0).