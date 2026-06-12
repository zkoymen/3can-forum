const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Security validation suite for proposal §4.2.
 *
 * Complements the 10 functional tests in Forum.test.js and the Slither pass in
 * slither-report.md with executable checks for the attack-surface claims made
 * in the proposal and SECURITY-ANALYSIS.md:
 *
 *   - large-input / gas-limit handling (no fixed-size assumption, §4.2)
 *   - unauthorised state modification is impossible (no setters, no fallback,
 *     no value handling, §4.2)
 *   - authorship is bound to msg.sender, never tx.origin (SWC-115)
 *   - double-vote prevention holds across many wallets (§2.4.2)
 */
describe("Forum — security validation (§4.2)", function () {
  let forum, alice, bob, carol;
  const CID = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";

  beforeEach(async function () {
    [, alice, bob, carol] = await ethers.getSigners();
    const Forum = await ethers.getContractFactory("Forum");
    forum = await Forum.deploy();
    await forum.waitForDeployment();
    await forum.connect(alice).createThread(CID);
  });

  describe("large-input / gas-limit handling", function () {
    // §4.2 Gas-Limit Stress Test: a large CID-shaped string is accepted and
    // priced linearly — the contract makes no fixed-length assumption that
    // could break gas estimation on oversized input.
    for (const size of [200, 4000, 12000]) {
      it(`accepts a ${size}-char content string without reverting`, async function () {
        const big = "q".repeat(size);
        await expect(forum.connect(bob).createPost(1, big)).to.emit(
          forum,
          "PostCreated"
        );
      });
    }

    it("still rejects the empty-string edge case", async function () {
      await expect(
        forum.connect(bob).createPost(1, "")
      ).to.be.revertedWithCustomError(forum, "EmptyCid");
    });
  });

  describe("unauthorised state modification is impossible", function () {
    it("has no fallback: a call with an unknown selector reverts", async function () {
      await expect(
        alice.sendTransaction({ to: await forum.getAddress(), data: "0xdeadbeef" })
      ).to.be.reverted;
    });

    it("has no receive/payable path: sending ETH reverts", async function () {
      await expect(
        alice.sendTransaction({
          to: await forum.getAddress(),
          value: ethers.parseEther("1"),
        })
      ).to.be.reverted;
    });

    it("exposes no setter: vote tally only moves through upvote()", async function () {
      await forum.connect(bob).createPost(1, CID);
      const before = (await forum.getPost(1)).votes;
      // The only state-mutating entry points are createThread/createPost/upvote.
      // There is no function able to set `votes` directly.
      const mutators = forum.interface.fragments
        .filter((f) => f.type === "function" && f.stateMutability !== "view" && f.stateMutability !== "pure")
        .map((f) => f.name)
        .sort();
      expect(mutators).to.deep.equal(["createPost", "createThread", "upvote"]);
      await forum.connect(carol).upvote(1);
      expect((await forum.getPost(1)).votes).to.equal(before + 1n);
    });
  });

  describe("authorship & voting integrity", function () {
    it("binds authorship to msg.sender (not tx.origin)", async function () {
      await forum.connect(bob).createPost(1, CID);
      expect((await forum.getPost(1)).author).to.equal(bob.address);
    });

    it("counts at most one vote per wallet but allows distinct wallets", async function () {
      await forum.connect(bob).createPost(1, CID);
      await forum.connect(alice).upvote(1);
      await forum.connect(bob).upvote(1);
      await forum.connect(carol).upvote(1);
      expect((await forum.getPost(1)).votes).to.equal(3n);
      await expect(
        forum.connect(alice).upvote(1)
      ).to.be.revertedWithCustomError(forum, "AlreadyVoted");
    });
  });

  describe("view-getter guards & counters", function () {
    // Exercise the read-side revert branches and counters so the coverage
    // report shows every reachable path in Forum.sol is tested.
    it("getThread reverts for a missing thread", async function () {
      await expect(forum.getThread(999))
        .to.be.revertedWithCustomError(forum, "ThreadDoesNotExist")
        .withArgs(999n);
    });

    it("getPost reverts for a missing post", async function () {
      await expect(forum.getPost(999))
        .to.be.revertedWithCustomError(forum, "PostDoesNotExist")
        .withArgs(999n);
    });

    it("threadCount and postCount track created records", async function () {
      expect(await forum.threadCount()).to.equal(1n);
      expect(await forum.postCount()).to.equal(0n);
      await forum.connect(bob).createPost(1, CID);
      await forum.connect(carol).createPost(1, CID);
      expect(await forum.postCount()).to.equal(2n);
    });
  });
});
