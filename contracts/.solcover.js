// solidity-coverage configuration.
// The benchmark contracts under contracts/benchmarks/ exist only to produce
// the gas-comparison numbers required by proposal §4.3; they are never
// deployed and are not part of the product. Skipping them keeps the coverage
// report focused on the one contract that actually ships, Forum.sol.
module.exports = {
  skipFiles: ["benchmarks"],
};
